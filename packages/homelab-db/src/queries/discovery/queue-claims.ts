import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  type DiscoveryQueueItem,
} from '../../schema/discovery';
import { skipExcludedQueueItems } from '../exclusion-rules';
import { skipInventoriedQueueItems } from '../inventory-items';
import { DiscoveryError } from '../shared';
import { ACTIVE_JOB_STATUSES, activeClaim, claimMissError } from './claims';
import {
  expireLeases,
  getQueueCounts,
  type QueueCounts,
} from './queue-helpers';
import type { Tx } from '../shared';

export type ClaimQueueItemInput = {
  jobId: string;
  workerId: string;
  leaseSeconds: number;
};

/** Why a claim found nothing, so a worker knows whether to wait or stop. */
export type ClaimIdleReason = 'queue_empty' | 'retry_backoff' | 'in_progress';

/** The job a claimed item belongs to, so a worker needs no separate lookup. */
export type ClaimedJob = { id: string; sourceId: string; rootPath: string };

export type ClaimQueueItemResult =
  | {
      item: DiscoveryQueueItem;
      job: ClaimedJob;
      /** The job's queue after this claim, so a worker can budget its run. */
      queueCounts: QueueCounts;
    }
  | {
      item: null;
      /**
       * `queue_empty`: nothing queued or in progress — the job can be completed.
       * `retry_backoff`: queued items are waiting out a retry delay.
       * `in_progress`: only other workers' leases remain.
       */
      reason: ClaimIdleReason;
      /** When it is worth asking again; null for `queue_empty`. */
      retryAt: Date | null;
      queueCounts: QueueCounts;
    };

/**
 * Atomically claims the highest-priority eligible directory of an active
 * job's queue. Expired leases are reclaimed first, so abandoned work is
 * picked up by the next caller. The job row is locked for the whole claim,
 * which serializes claimers per job and keeps a concurrent cancel or fail
 * from interleaving (it would otherwise miss the item being claimed);
 * `FOR UPDATE SKIP LOCKED` on the item is the second guard that no row is
 * ever handed out twice. The first claim also moves the job from pending to
 * running. When nothing can be claimed the result says why.
 */
export const claimNextQueueItem = async (
  db: Database,
  input: ClaimQueueItemInput,
): Promise<ClaimQueueItemResult> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, input.jobId))
      .for('no key update');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError('conflict', `job is ${job.status}`);
    }

    await expireLeases(tx, job.id);
    // Enforcement point for exclusion rules: anything queued before a rule
    // existed (or enqueued under one) is skipped here, under the job lock,
    // before it can be handed out.
    await skipExcludedQueueItems(tx, { jobId: job.id, sourceId: job.sourceId });
    // Likewise for an approved directory inventory item: its subtree is
    // covered, so nothing inside it is handed out.
    await skipInventoriedQueueItems(tx, {
      jobId: job.id,
      sourceId: job.sourceId,
    });

    const t = discoveryQueueItems;
    const [next] = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          eq(t.jobId, job.id),
          eq(t.status, 'queued'),
          lte(t.availableAt, sql`now()`),
        ),
      )
      .orderBy(desc(t.priority), asc(t.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) return describeIdleQueue(tx, job.id);

    const [item] = await tx
      .update(t)
      .set({
        status: 'in_progress',
        attemptCount: sql`${t.attemptCount} + 1`,
        claimedBy: input.workerId,
        lastClaimedBy: input.workerId,
        claimToken: sql`gen_random_uuid()`,
        leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
        updatedAt: sql`now()`,
      })
      .where(eq(t.id, next.id))
      .returning();

    if (job.status === 'pending') {
      await tx
        .update(discoveryJobs)
        .set({
          status: 'running',
          startedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(discoveryJobs.id, job.id));
    }

    return {
      item,
      job: { id: job.id, sourceId: job.sourceId, rootPath: job.rootPath },
      queueCounts: await getQueueCounts(tx, job.id),
    };
  });

export type ClaimAnyInput = {
  workerId: string;
  leaseSeconds: number;
  /** Only consider this source's active job. */
  sourceId?: string;
};

/**
 * Claims the next directory of the oldest active job that has one, so a
 * worker with no job id asks one question. Idle only when no active job can
 * hand out work: `queue_empty` (stop) if every job is drained or none exist,
 * otherwise the soonest `retryAt` of the jobs that are merely waiting. Counts
 * in the idle result are summed over the active jobs.
 */
export const claimNextAcrossJobs = async (
  db: Database,
  input: ClaimAnyInput,
): Promise<ClaimQueueItemResult> => {
  const jobs = await db
    .select({ id: discoveryJobs.id })
    .from(discoveryJobs)
    .where(
      and(
        inArray(discoveryJobs.status, ACTIVE_JOB_STATUSES),
        input.sourceId ? eq(discoveryJobs.sourceId, input.sourceId) : undefined,
      ),
    )
    .orderBy(asc(discoveryJobs.createdAt));

  const idle: Extract<ClaimQueueItemResult, { item: null }> = {
    item: null,
    reason: 'queue_empty',
    retryAt: null,
    queueCounts: {
      queued: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
  };

  for (const { id } of jobs) {
    let result: ClaimQueueItemResult;
    try {
      result = await claimNextQueueItem(db, {
        jobId: id,
        workerId: input.workerId,
        leaseSeconds: input.leaseSeconds,
      });
    } catch (err) {
      // The job finished between listing and claiming: nothing to take there.
      if (err instanceof DiscoveryError && err.code === 'conflict') continue;
      throw err;
    }

    if (!('reason' in result)) return result;

    for (const key of Object.keys(idle.queueCounts) as (keyof QueueCounts)[]) {
      idle.queueCounts[key] += result.queueCounts[key];
    }
    if (result.reason === 'queue_empty') continue;

    // A waiting job outranks a drained one; among waiting ones the soonest wins.
    if (idle.reason === 'queue_empty' || result.reason === 'retry_backoff') {
      idle.reason = result.reason;
    }
    if (result.retryAt && (!idle.retryAt || result.retryAt < idle.retryAt)) {
      idle.retryAt = result.retryAt;
    }
  }

  return idle;
};

const describeIdleQueue = async (
  tx: Tx,
  jobId: string,
): Promise<Extract<ClaimQueueItemResult, { item: null }>> => {
  const queueCounts = await getQueueCounts(tx, jobId);
  const t = discoveryQueueItems;

  if (queueCounts.queued > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.availableAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'queued')));

    return {
      item: null,
      reason: 'retry_backoff',
      retryAt: row.at ? new Date(row.at) : null,
      queueCounts,
    };
  }

  if (queueCounts.in_progress > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.leaseExpiresAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'in_progress')));

    return {
      item: null,
      reason: 'in_progress',
      retryAt: row.at ? new Date(row.at) : null,
      queueCounts,
    };
  }

  return { item: null, reason: 'queue_empty', retryAt: null, queueCounts };
};

export const heartbeatQueueItem = async (
  db: Database,
  id: string,
  input: { claimToken: string; leaseSeconds: number },
): Promise<DiscoveryQueueItem> => {
  const [row] = await db
    .update(discoveryQueueItems)
    .set({
      leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
      updatedAt: sql`now()`,
    })
    .where(activeClaim(id, input.claimToken))
    .returning();

  if (!row) throw await claimMissError(db, id);

  return row;
};
