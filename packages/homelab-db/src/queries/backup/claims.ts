import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupJobItems,
  backupJobs,
  type BackupJob,
  type BackupJobItem,
  type BackupJobStalledReason,
} from '../../schema/backup';
import { insertAuditEvent } from '../audit';
import { retryDelaySeconds } from '../discovery/queue-items';
import type { Tx } from '../shared';
import { getBackupDestination } from './destinations';
import { getBackupItemCounts, listActiveBackupJobs } from './jobs';
import type { BackupItemCounts } from './jobs';
import { expireBackupLeases } from './leases';
import { countUnresolvedBackupEntries } from './items';
import {
  ACTIVE_BACKUP_JOB_STATUSES,
  BackupError,
  activeItemClaim,
  itemClaimMissError,
  settledByItemClaim,
} from './shared';

export type ClaimBackupItemInput = {
  destinationId: string;
  workerId: string;
  leaseSeconds: number;
};

/**
 * Why a claim found nothing, so a worker knows whether to wait, pause or
 * check whether the job is finished. The three pause reasons spend no
 * attempts; `queue_empty` means every active job is drained and the worker
 * should run the job completion check.
 */
export type BackupClaimIdleReason =
  | 'queue_empty'
  | 'retry_backoff'
  | 'in_progress'
  | BackupJobStalledReason;

export type ClaimBackupItemResult =
  | { item: BackupJobItem; job: BackupJob }
  | {
      item: null;
      reason: BackupClaimIdleReason;
      /** When it is worth asking again; null when there is nothing to wait for. */
      retryAt: Date | null;
      /** Active jobs of the destination that are drained (for the completion check). */
      drainedJobIds: string[];
    };

type IdleOutcome = {
  reason: BackupClaimIdleReason;
  retryAt: Date | null;
  drained: boolean;
};

/** Higher wins when several jobs are idle for different reasons. */
const IDLE_RANK: Record<BackupClaimIdleReason, number> = {
  queue_empty: 0,
  in_progress: 1,
  retry_backoff: 2,
  source_unreachable: 3,
  destination_unhealthy: 3,
  destination_disabled: 3,
};

/**
 * Claims the next item of the oldest active job of a destination that has
 * one. A disabled or unhealthy destination hands out nothing. Expired leases
 * are reclaimed first, so abandoned work is picked up by the next caller. The
 * job row is locked for the whole claim, which serializes claimers per job
 * and keeps a concurrent cancel or fail from interleaving;
 * `FOR UPDATE SKIP LOCKED` on the item is the second guard that no row is
 * ever handed out twice. The first claim also moves the job from `planned` to
 * `running`. A job with a `stalled_reason` is paused and hands out nothing.
 */
export const claimNextBackupItem = async (
  db: Database,
  input: ClaimBackupItemInput,
): Promise<ClaimBackupItemResult> => {
  const destination = await getBackupDestination(db, input.destinationId);
  if (!destination) {
    throw new BackupError('not_found', 'backup destination not found');
  }
  if (!destination.enabled) {
    return idle('destination_disabled', null, []);
  }
  if (destination.health === 'unhealthy') {
    return idle('destination_unhealthy', null, []);
  }

  const jobs = await listActiveBackupJobs(db, input.destinationId);

  let outcome: IdleOutcome = {
    reason: 'queue_empty',
    retryAt: null,
    drained: false,
  };
  const drainedJobIds: string[] = [];

  for (const { id } of jobs) {
    let result: ClaimBackupItemResult | (IdleOutcome & { item: null });
    try {
      result = await claimInJob(db, id, input);
    } catch (err) {
      // The job finished between listing and claiming: nothing to take there.
      if (err instanceof BackupError && err.code === 'conflict') continue;
      throw err;
    }

    if (result.item) return result;

    if (result.drained) drainedJobIds.push(id);
    if (IDLE_RANK[result.reason] > IDLE_RANK[outcome.reason]) {
      outcome = { ...outcome, reason: result.reason };
    }
    if (
      result.retryAt &&
      (!outcome.retryAt || result.retryAt < outcome.retryAt)
    ) {
      outcome = { ...outcome, retryAt: result.retryAt };
    }
  }

  return idle(outcome.reason, outcome.retryAt, drainedJobIds);
};

const idle = (
  reason: BackupClaimIdleReason,
  retryAt: Date | null,
  drainedJobIds: string[],
): ClaimBackupItemResult => ({ item: null, reason, retryAt, drainedJobIds });

const claimInJob = async (
  db: Database,
  jobId: string,
  input: ClaimBackupItemInput,
): Promise<
  { item: BackupJobItem; job: BackupJob } | (IdleOutcome & { item: null })
> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, jobId))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');

    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      throw new BackupError('conflict', `job is ${job.status}`);
    }

    if (job.stalledReason) {
      return {
        item: null,
        reason: job.stalledReason,
        retryAt: null,
        drained: false,
      };
    }

    await expireBackupLeases(tx, job.id);

    const t = backupJobItems;
    const [next] = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          eq(t.jobId, job.id),
          eq(t.status, 'queued'),
          lte(t.availableAt, sql`now()`),
          sql`${t.attemptCount} < ${t.maxAttempts}`,
        ),
      )
      .orderBy(asc(t.normalizedRootPath), asc(t.id))
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) {
      return {
        item: null,
        ...(await describeIdleJob(tx, job.id)),
      };
    }

    const [item] = await tx
      .update(t)
      .set({
        status: 'in_progress',
        attemptCount: sql`${t.attemptCount} + 1`,
        claimedBy: input.workerId,
        lastClaimedBy: input.workerId,
        claimToken: sql`gen_random_uuid()`,
        leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
        startedAt: sql`coalesce(${t.startedAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(eq(t.id, next.id))
      .returning();

    let claimedJob = job;
    if (job.status === 'planned') {
      [claimedJob] = await tx
        .update(backupJobs)
        .set({
          status: 'running',
          startedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(backupJobs.id, job.id))
        .returning();

      await insertAuditEvent(tx, {
        eventType: 'backup_job.started',
        actor: { type: 'system', id: input.workerId },
        sourceId: job.sourceId,
        destinationId: job.destinationId,
        backupJobId: job.id,
      });
    }

    return { item, job: claimedJob };
  });

const describeIdleJob = async (tx: Tx, jobId: string): Promise<IdleOutcome> => {
  const counts: BackupItemCounts = await getBackupItemCounts(tx, jobId);
  const t = backupJobItems;

  if (counts.queued > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.availableAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'queued')));

    return {
      reason: 'retry_backoff',
      retryAt: row.at ? new Date(row.at) : null,
      drained: false,
    };
  }

  if (counts.in_progress > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.leaseExpiresAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'in_progress')));

    return {
      reason: 'in_progress',
      retryAt: row.at ? new Date(row.at) : null,
      drained: false,
    };
  }

  return { reason: 'queue_empty', retryAt: null, drained: true };
};

export const heartbeatBackupItem = async (
  db: Database,
  id: string,
  input: { claimToken: string; leaseSeconds: number },
): Promise<BackupJobItem> => {
  const [row] = await db
    .update(backupJobItems)
    .set({
      leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
      updatedAt: sql`now()`,
    })
    .where(activeItemClaim(id, input.claimToken))
    .returning();

  if (!row) throw await itemClaimMissError(db, id);

  return row;
};

/** Locks the owning job before the item, the order cancel and fail use. */
const lockJobOf = async (tx: Tx, itemId: string): Promise<void> => {
  const [owner] = await tx
    .select({ jobId: backupJobItems.jobId })
    .from(backupJobItems)
    .where(eq(backupJobItems.id, itemId));

  if (owner) {
    await tx
      .select({ id: backupJobs.id })
      .from(backupJobs)
      .where(eq(backupJobs.id, owner.jobId))
      .for('share');
  }
};

const itemAuditContext = async (tx: Tx, item: BackupJobItem) => {
  const [job] = await tx
    .select({
      sourceId: backupJobs.sourceId,
      destinationId: backupJobs.destinationId,
    })
    .from(backupJobs)
    .where(eq(backupJobs.id, item.jobId));

  return {
    sourceId: job?.sourceId,
    destinationId: job?.destinationId,
    backupJobId: item.jobId,
    backupJobItemId: item.id,
  };
};

/**
 * Marks the claimed item `verified`. Allowed only when its enumeration is
 * complete and no entry is `pending` or `failed`; otherwise it conflicts and
 * the worker finishes through `failBackupItem`. A file item has exactly one
 * entry, so the worker records it and marks enumeration complete first.
 * Repeating the call with the same token answers from the settled row.
 */
export const completeBackupItem = async (
  db: Database,
  id: string,
  input: { claimToken: string },
): Promise<BackupJobItem> =>
  db.transaction(async (tx) => {
    await lockJobOf(tx, id);

    const [current] = await tx
      .select()
      .from(backupJobItems)
      .where(activeItemClaim(id, input.claimToken))
      .for('update');

    if (!current) {
      const replay = await settledByItemClaim(tx, id, input.claimToken, [
        'verified',
      ]);
      if (!replay) throw await itemClaimMissError(tx, id);

      return replay;
    }

    if (!current.enumerationComplete) {
      throw new BackupError('conflict', 'enumeration is not complete');
    }
    const unresolved = await countUnresolvedBackupEntries(tx, id);
    if (unresolved > 0) {
      throw new BackupError(
        'conflict',
        `${unresolved} entries are still pending or failed`,
        { unresolvedEntries: unresolved },
      );
    }

    const [row] = await tx
      .update(backupJobItems)
      .set({
        status: 'verified',
        lastError: null,
        completedAt: sql`now()`,
        claimedBy: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobItems.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_job_item.verified',
      actor: { type: 'system', id: current.claimedBy },
      ...(await itemAuditContext(tx, row)),
      details: { attemptCount: row.attemptCount },
    });

    return row;
  });

export type FailBackupItemInput = {
  claimToken: string;
  error: string;
  /**
   * `transient` (read, write or verify failures) retries behind a backoff
   * while attempts remain, then fails; `permanent` (source missing, name too
   * long, destination conflict, unlistable) blocks at once.
   */
  kind: 'transient' | 'permanent';
};

/**
 * Records a failure of the claimed item. The error is kept either way.
 * Repeating the call with the same token answers from the settled row (a
 * requeued item has no token left, so a repeat then conflicts).
 */
export const failBackupItem = async (
  db: Database,
  id: string,
  input: FailBackupItemInput,
): Promise<BackupJobItem> =>
  db.transaction(async (tx) => {
    await lockJobOf(tx, id);

    const [current] = await tx
      .select()
      .from(backupJobItems)
      .where(activeItemClaim(id, input.claimToken))
      .for('update');

    if (!current) {
      const replay = await settledByItemClaim(tx, id, input.claimToken, [
        'failed',
        'blocked',
      ]);
      if (!replay) throw await itemClaimMissError(tx, id);

      return replay;
    }

    const attemptsLeft = current.attemptCount < current.maxAttempts;
    const status =
      input.kind === 'permanent'
        ? 'blocked'
        : attemptsLeft
          ? 'queued'
          : 'failed';
    const delay = retryDelaySeconds(current.attemptCount);

    const [row] = await tx
      .update(backupJobItems)
      .set({
        status,
        lastError: input.error,
        availableAt:
          status === 'queued'
            ? sql`now() + make_interval(secs => ${delay})`
            : current.availableAt,
        claimedBy: null,
        // Settled items keep the token so a repeated call can be answered.
        claimToken: status === 'queued' ? null : current.claimToken,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobItems.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType:
        status === 'queued'
          ? 'backup_job_item.attempt_failed'
          : status === 'blocked'
            ? 'backup_job_item.blocked'
            : 'backup_job_item.failed',
      actor: { type: 'system', id: current.claimedBy },
      ...(await itemAuditContext(tx, row)),
      details: {
        error: input.error,
        kind: input.kind,
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        ...(status === 'queued' ? { retryInSeconds: delay } : {}),
      },
    });

    return row;
  });

/**
 * Hands a claim back without finishing it: the item returns to `queued` at
 * once and the attempt is refunded, since the worker chose to stop (SIGTERM)
 * rather than failing or vanishing. Entries already verified stay verified.
 */
export const releaseBackupItem = async (
  db: Database,
  id: string,
  input: { claimToken: string },
): Promise<BackupJobItem> => {
  const t = backupJobItems;

  const [row] = await db
    .update(t)
    .set({
      status: 'queued',
      attemptCount: sql`greatest(${t.attemptCount} - 1, 0)`,
      lastError: sql`'released by ' || coalesce(${t.claimedBy}, 'unknown')`,
      availableAt: sql`now()`,
      claimedBy: null,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: sql`now()`,
    })
    .where(activeItemClaim(id, input.claimToken))
    .returning();

  if (!row) throw await itemClaimMissError(db, id);

  return row;
};
