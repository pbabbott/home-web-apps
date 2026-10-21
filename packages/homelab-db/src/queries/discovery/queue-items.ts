import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type QueueItemResult,
} from '../../schema/discovery';
import { skipExcludedQueueItems } from '../exclusion-rules';
import { DiscoveryError } from '../shared';
import {
  ACTIVE_JOB_STATUSES,
  activeClaim,
  claimMissError,
  jobIsActive,
} from './claims';
import {
  expireLeases,
  getQueueCounts,
  insertQueuePaths,
  type QueueCounts,
  type QueuePath,
} from './queue-helpers';
import type { Tx } from '../shared';

// -- queue items ------------------------------------------------------------

export const getQueueItemById = async (
  db: Database,
  id: string,
): Promise<DiscoveryQueueItem | undefined> => {
  const [row] = await db
    .select()
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.id, id));

  return row;
};

export type ListQueueItemsOptions = {
  /** Items of any job of this source. */
  sourceId?: string;
  jobId?: string;
  status?: DiscoveryQueueItemStatus;
};

const LIST_QUEUE_ITEMS_LIMIT = 500;

/**
 * Most recently changed first, so when a big job exceeds the limit it is the
 * oldest, settled items that drop off rather than fresh failures.
 */
export const listQueueItems = async (
  db: Database,
  options: ListQueueItemsOptions,
): Promise<DiscoveryQueueItem[]> => {
  const rows = await db
    .select({ item: discoveryQueueItems })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(
      and(
        options.sourceId
          ? eq(discoveryJobs.sourceId, options.sourceId)
          : undefined,
        options.jobId
          ? eq(discoveryQueueItems.jobId, options.jobId)
          : undefined,
        options.status
          ? eq(discoveryQueueItems.status, options.status)
          : undefined,
      ),
    )
    .orderBy(desc(discoveryQueueItems.updatedAt), asc(discoveryQueueItems.path))
    .limit(LIST_QUEUE_ITEMS_LIMIT);

  return rows.map((row) => row.item);
};

export type EnqueueQueueItemsInput = {
  jobId: string;
  paths: QueuePath[];
  priority?: number;
};

/**
 * Enqueues directories for an active job; already-queued paths are skipped.
 * The job row is share-locked so this cannot interleave with completing,
 * cancelling or failing the job: either it runs first and the job then sees
 * the new work, or it waits and is rejected because the job is finished.
 */
export const enqueueQueueItems = async (
  db: Database,
  input: EnqueueQueueItemsInput,
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, input.jobId))
      .for('share');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError('conflict', `job is ${job.status}`);
    }

    const inserted = await insertQueuePaths(tx, {
      jobId: job.id,
      paths: input.paths,
      priority: input.priority,
    });

    return refreshAfterExclusion(tx, job, inserted);
  });

/**
 * Applies exclusion rules to freshly queued paths in the same transaction, so
 * work under an `exclude_subtree` rule is `skipped` the moment it is queued
 * rather than waiting for the next claim. Claim rechecks too, because rules
 * can change after work was queued. Returns the rows as they now stand.
 */
const refreshAfterExclusion = async (
  tx: Tx,
  job: { id: string; sourceId: string },
  queued: { item: DiscoveryQueueItem; created: boolean }[],
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> => {
  if (queued.length === 0) return queued;

  const skipped = await skipExcludedQueueItems(tx, {
    jobId: job.id,
    sourceId: job.sourceId,
  });
  if (skipped === 0) return queued;

  const rows = await tx
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.jobId, job.id),
        inArray(
          discoveryQueueItems.id,
          queued.map((q) => q.item.id),
        ),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));

  return queued.map((q) => ({ ...q, item: byId.get(q.item.id) ?? q.item }));
};

export type ClaimQueueItemInput = {
  jobId: string;
  workerId: string;
  leaseSeconds: number;
};

/** Why a claim found nothing, so a worker knows whether to wait or stop. */
export type ClaimIdleReason = 'queue_empty' | 'retry_backoff' | 'in_progress';

export type ClaimQueueItemResult =
  | { item: DiscoveryQueueItem }
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

    return { item };
  });

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

export type CompleteQueueItemInput = {
  claimToken: string;
  /** Child directories found while inspecting this one. */
  discoveredPaths?: QueuePath[];
  /** What the worker concluded, including paths it saw but chose not to queue. */
  result?: QueueItemResult;
};

/**
 * Marks the claimed item completed and enqueues its discovered children in
 * the same transaction, so a crash can't complete a directory while losing
 * the subdirectories it found.
 */
export const completeQueueItem = async (
  db: Database,
  id: string,
  input: CompleteQueueItemInput,
): Promise<{
  item: DiscoveryQueueItem;
  children: { item: DiscoveryQueueItem; created: boolean }[];
}> =>
  db.transaction(async (tx) => {
    // Share-lock the job first so a concurrent cancel/fail cannot slip
    // between the completion and the enqueue of its children.
    const [owner] = await tx
      .select({ jobId: discoveryQueueItems.jobId })
      .from(discoveryQueueItems)
      .where(eq(discoveryQueueItems.id, id));

    if (owner) {
      await tx
        .select({ id: discoveryJobs.id })
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, owner.jobId))
        .for('share');
    }

    const [item] = await tx
      .update(discoveryQueueItems)
      .set({
        status: 'completed',
        ...(input.result ? { result: input.result } : {}),
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(activeClaim(id, input.claimToken))
      .returning();

    if (!item) throw await claimMissError(tx, id);

    const inserted = await insertQueuePaths(tx, {
      jobId: item.jobId,
      paths: input.discoveredPaths ?? [],
    });
    const [job] = await tx
      .select({ id: discoveryJobs.id, sourceId: discoveryJobs.sourceId })
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, item.jobId));

    return { item, children: await refreshAfterExclusion(tx, job, inserted) };
  });

export type FailQueueItemInput = {
  claimToken: string;
  error: string;
  retryable: boolean;
};

const RETRY_BASE_SECONDS = 30;
const RETRY_MAX_SECONDS = 3600;

/** Exponential backoff after the nth attempt: 30s, 60s, 120s, … capped at 1h. */
export const retryDelaySeconds = (attemptCount: number): number =>
  Math.min(
    RETRY_BASE_SECONDS * 2 ** Math.max(attemptCount - 1, 0),
    RETRY_MAX_SECONDS,
  );

/**
 * Records a failure. A retryable item with attempts left returns to `queued`
 * behind a backoff delay; otherwise it becomes `failed` (permanent until a
 * human retries it). The error is kept either way.
 */
export const failQueueItem = async (
  db: Database,
  id: string,
  input: FailQueueItemInput,
): Promise<DiscoveryQueueItem> =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(discoveryQueueItems)
      .where(activeClaim(id, input.claimToken))
      .for('update');

    if (!current) throw await claimMissError(tx, id);

    const willRetry =
      input.retryable && current.attemptCount < current.maxAttempts;

    const [row] = await tx
      .update(discoveryQueueItems)
      .set({
        status: willRetry ? 'queued' : 'failed',
        lastError: input.error,
        availableAt: willRetry
          ? sql`now() + make_interval(secs => ${retryDelaySeconds(current.attemptCount)})`
          : current.availableAt,
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(discoveryQueueItems.id, id))
      .returning();

    return row;
  });

export const skipQueueItem = async (
  db: Database,
  id: string,
  input: { claimToken: string; reason: string },
): Promise<DiscoveryQueueItem> => {
  const [row] = await db
    .update(discoveryQueueItems)
    .set({
      status: 'skipped',
      lastError: `skipped: ${input.reason}`,
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(activeClaim(id, input.claimToken))
    .returning();

  if (!row) throw await claimMissError(db, id);

  return row;
};

/**
 * Human-requested retry of a `failed` item. Grants exactly one more attempt
 * (maxAttempts = attemptCount + 1) while keeping attemptCount and lastError,
 * so the history stays visible and a still-broken directory can't loop.
 */
export const retryQueueItem = async (
  db: Database,
  id: string,
): Promise<DiscoveryQueueItem> => {
  const t = discoveryQueueItems;

  return db.transaction(async (tx) => {
    // Share-lock the job first so a concurrent cancel/fail/complete cannot
    // interleave with the requeue.
    const [owner] = await tx
      .select({ jobId: t.jobId })
      .from(t)
      .where(eq(t.id, id));

    if (owner) {
      await tx
        .select({ id: discoveryJobs.id })
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, owner.jobId))
        .for('share');
    }

    const [row] = await tx
      .update(t)
      .set({
        status: 'queued',
        maxAttempts: sql`${t.attemptCount} + 1`,
        availableAt: sql`now()`,
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(t.id, id), eq(t.status, 'failed'), jobIsActive(t.jobId)))
      .returning();

    if (row) return row;

    const [existing] = await tx
      .select({ status: t.status, jobStatus: discoveryJobs.status })
      .from(t)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, t.jobId))
      .where(eq(t.id, id));

    if (!existing)
      throw new DiscoveryError('not_found', 'queue item not found');

    if (existing.status !== 'failed') {
      throw new DiscoveryError(
        'conflict',
        `only failed items can be retried (item is ${existing.status})`,
      );
    }

    throw new DiscoveryError(
      'conflict',
      `job is ${existing.jobStatus}; start a new discovery job to explore this directory again`,
    );
  });
};
