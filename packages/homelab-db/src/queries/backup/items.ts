import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupEntries,
  backupJobItems,
  backupJobs,
  type BackupJobItem,
  type BackupJobItemStatus,
} from '../../schema/backup';
import { insertAuditEvent, type Actor } from '../audit';
import type { Tx } from '../shared';
import {
  ACTIVE_BACKUP_JOB_STATUSES,
  BackupError,
  activeItemClaim,
  backupJobIsActive,
  itemClaimMissError,
} from './shared';

export const getBackupJobItem = async (
  db: Database | Tx,
  id: string,
): Promise<BackupJobItem | undefined> => {
  const [row] = await db
    .select()
    .from(backupJobItems)
    .where(eq(backupJobItems.id, id));

  return row;
};

export type ListBackupJobItemsOptions = {
  jobId: string;
  status?: BackupJobItemStatus;
  /** Keyset cursor: the normalized root path of the last item of the previous page. */
  after?: string;
  limit?: number;
};

const LIST_ITEMS_DEFAULT_LIMIT = 100;
const LIST_ITEMS_MAX_LIMIT = 500;

/** Ordered by normalized root path, which is unique per job for a given inventory item. */
export const listBackupJobItems = async (
  db: Database,
  options: ListBackupJobItemsOptions,
): Promise<BackupJobItem[]> => {
  const t = backupJobItems;

  return db
    .select()
    .from(t)
    .where(
      and(
        eq(t.jobId, options.jobId),
        options.status ? eq(t.status, options.status) : undefined,
        options.after ? gt(t.normalizedRootPath, options.after) : undefined,
      ),
    )
    .orderBy(asc(t.normalizedRootPath), asc(t.id))
    .limit(
      Math.min(options.limit ?? LIST_ITEMS_DEFAULT_LIMIT, LIST_ITEMS_MAX_LIMIT),
    );
};

/**
 * Records that the item's tree has been listed completely, so the item may be
 * verified once its entries are. Guarded by the live claim.
 */
export const markBackupEnumerationComplete = async (
  db: Database,
  id: string,
  input: { claimToken: string },
): Promise<BackupJobItem> => {
  const [row] = await db
    .update(backupJobItems)
    .set({
      enumerationComplete: true,
      enumeratedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(activeItemClaim(id, input.claimToken))
    .returning();

  if (!row) throw await itemClaimMissError(db, id);

  return row;
};

const RETRYABLE: BackupJobItemStatus[] = ['failed', 'blocked'];

/**
 * Human-requested retry of a `failed` or `blocked` item. Grants exactly one
 * more attempt (maxAttempts = attemptCount + 1) while keeping attemptCount
 * and lastError, so the history stays visible and a still-broken item can't
 * loop. Only while the job is active; a finished job needs a new job.
 */
export const retryBackupJobItem = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<BackupJobItem> => {
  const t = backupJobItems;

  return db.transaction(async (tx) => {
    // Share-lock the job first so a concurrent cancel/fail/complete cannot
    // interleave with the requeue.
    const [owner] = await tx
      .select({ jobId: t.jobId })
      .from(t)
      .where(eq(t.id, id));

    if (owner) {
      await tx
        .select({ id: backupJobs.id })
        .from(backupJobs)
        .where(eq(backupJobs.id, owner.jobId))
        .for('share');
    }

    const [row] = await tx
      .update(t)
      .set(requeueForRetry())
      .where(
        and(
          eq(t.id, id),
          inArray(t.status, RETRYABLE),
          backupJobIsActive(t.jobId),
        ),
      )
      .returning();

    if (!row) throw await retryMissError(tx, id);

    await auditRetried(tx, row, actor);

    return row;
  });
};

/**
 * Human-requested retry of every `failed` and `blocked` item of an active
 * job, each granted exactly one more attempt as in `retryBackupJobItem`.
 * Returns the requeued items (none is fine: nothing had failed).
 */
export const retryFailedBackupJobItems = async (
  db: Database,
  jobId: string,
  actor: Actor,
): Promise<BackupJobItem[]> => {
  const t = backupJobItems;

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, jobId))
      .for('share');

    if (!job) throw new BackupError('not_found', 'backup job not found');

    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      throw new BackupError(
        'conflict',
        `job is ${job.status}; create a new job to copy these items again`,
      );
    }

    const rows = await tx
      .update(t)
      .set(requeueForRetry())
      .where(and(eq(t.jobId, jobId), inArray(t.status, RETRYABLE)))
      .returning();

    for (const row of rows) await auditRetried(tx, row, actor);

    return rows;
  });
};

const requeueForRetry = () => {
  const t = backupJobItems;

  return {
    status: 'queued' as const,
    maxAttempts: sql`${t.attemptCount} + 1`,
    availableAt: sql`now()`,
    claimedBy: null,
    claimToken: null,
    leaseExpiresAt: null,
    updatedAt: sql`now()`,
  };
};

const auditRetried = async (
  tx: Tx,
  item: BackupJobItem,
  actor: Actor,
): Promise<void> => {
  const [job] = await tx
    .select({
      sourceId: backupJobs.sourceId,
      destinationId: backupJobs.destinationId,
    })
    .from(backupJobs)
    .where(eq(backupJobs.id, item.jobId));

  await insertAuditEvent(tx, {
    eventType: 'backup_job_item.retried',
    actor,
    sourceId: job?.sourceId,
    destinationId: job?.destinationId,
    backupJobId: item.jobId,
    backupJobItemId: item.id,
    details: { attemptCount: item.attemptCount, maxAttempts: item.maxAttempts },
  });
};

const retryMissError = async (tx: Tx, id: string): Promise<BackupError> => {
  const [existing] = await tx
    .select({
      status: backupJobItems.status,
      jobStatus: backupJobs.status,
    })
    .from(backupJobItems)
    .innerJoin(backupJobs, eq(backupJobs.id, backupJobItems.jobId))
    .where(eq(backupJobItems.id, id));

  if (!existing)
    return new BackupError('not_found', 'backup job item not found');

  if (!RETRYABLE.includes(existing.status)) {
    return new BackupError(
      'conflict',
      `only failed or blocked items can be retried (item is ${existing.status})`,
    );
  }

  return new BackupError(
    'conflict',
    `job is ${existing.jobStatus}; create a new job to copy this item again`,
  );
};

/** Entries that stop an item from being verified: still pending, or failed. */
export const countUnresolvedBackupEntries = async (
  db: Database | Tx,
  jobItemId: string,
): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(backupEntries)
    .where(
      and(
        eq(backupEntries.jobItemId, jobItemId),
        inArray(backupEntries.status, ['pending', 'failed']),
      ),
    );

  return row.count;
};
