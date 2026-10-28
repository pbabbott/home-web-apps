import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { isUniqueViolation } from '../../pg-errors';
import {
  backupDestinations,
  backupEntries,
  backupJobItems,
  backupJobs,
  type BackupCarveOut,
  type BackupJob,
  type BackupJobItemStatus,
  type BackupJobSelection,
  type BackupJobStalledReason,
  type BackupJobStatus,
} from '../../schema/backup';
import type { InventoryItemKind } from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import type { Tx } from '../shared';
import { expireBackupLeases } from './leases';
import {
  ACTIVE_BACKUP_JOB_STATUSES,
  BACKUP_DIRECTORY_MAX_ATTEMPTS,
  BACKUP_FILE_MAX_ATTEMPTS,
  BackupError,
} from './shared';

/** One job item as planned: the snapshot taken when the job is created. */
export type PlannedBackupItem = {
  inventoryItemId: string;
  kind: InventoryItemKind;
  rootPath: string;
  normalizedRootPath: string;
  destRelPath: string;
  carveOuts?: BackupCarveOut[];
  estimatedSizeBytes?: number | null;
  /** `queued` to copy; `skipped` and `excluded` are recorded, never claimed. */
  status: Extract<BackupJobItemStatus, 'queued' | 'skipped' | 'excluded'>;
  statusReason?: string | null;
  /** For a redundant nested item: the inventory item whose copy contains it. */
  coveredByInventoryItemId?: string;
};

export type CreateBackupJobInput = {
  sourceId: string;
  destinationId: string;
  selection: BackupJobSelection;
  sourceDirName: string;
  items: PlannedBackupItem[];
  createdBy?: string | null;
};

const INSERT_CHUNK = 500;

export const BACKUP_TERMINAL_JOB_STATUSES: BackupJobStatus[] = [
  'completed',
  'completed_with_issues',
  'failed',
  'cancelled',
];

/**
 * Creates a `planned` job and all its items in one transaction: the scope is
 * frozen here and nothing adds items later. The destination row is
 * share-locked so it cannot be disabled or moved between the check and the
 * insert. One active job per (source, destination) is enforced by a partial
 * unique index and surfaces as a conflict.
 */
export const createBackupJob = async (
  db: Database,
  input: CreateBackupJobInput,
  actor: Actor,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    if (input.items.length === 0) {
      throw new BackupError('conflict', 'a backup job needs at least one item');
    }

    const [destination] = await tx
      .select()
      .from(backupDestinations)
      .where(eq(backupDestinations.id, input.destinationId))
      .for('share');

    if (!destination) {
      throw new BackupError('not_found', 'backup destination not found');
    }
    if (!destination.enabled) {
      throw new BackupError('conflict', 'backup destination is disabled');
    }

    let job: BackupJob;
    try {
      [job] = await tx
        .insert(backupJobs)
        .values({
          sourceId: input.sourceId,
          destinationId: input.destinationId,
          selection: input.selection,
          sourceDirName: input.sourceDirName,
          createdBy: input.createdBy ?? null,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new BackupError(
          'conflict',
          'this source already has an active backup job for this destination',
        );
      }
      throw err;
    }

    const rows = input.items.map((item) => ({
      jobId: job.id,
      inventoryItemId: item.inventoryItemId,
      kind: item.kind,
      rootPath: item.rootPath,
      normalizedRootPath: item.normalizedRootPath,
      destRelPath: item.destRelPath,
      carveOuts: item.carveOuts ?? [],
      estimatedSizeBytes: item.estimatedSizeBytes ?? null,
      status: item.status,
      statusReason: item.statusReason ?? null,
      maxAttempts:
        item.kind === 'file'
          ? BACKUP_FILE_MAX_ATTEMPTS
          : BACKUP_DIRECTORY_MAX_ATTEMPTS,
    }));

    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      await tx.insert(backupJobItems).values(rows.slice(i, i + INSERT_CHUNK));
    }

    const covered = input.items.filter((item) => item.coveredByInventoryItemId);
    if (covered.length > 0) {
      const t = backupJobItems;
      const cover = sql`covering`;
      for (const item of covered) {
        await tx
          .update(t)
          .set({
            coveredByJobItemId: sql`(select ${cover}.id from ${t} ${cover} where ${cover}.job_id = ${job.id} and ${cover}.inventory_item_id = ${item.coveredByInventoryItemId})`,
          })
          .where(
            and(
              eq(t.jobId, job.id),
              eq(t.inventoryItemId, item.inventoryItemId),
            ),
          );
      }
    }

    await insertAuditEvent(tx, {
      eventType: 'backup_job.created',
      actor,
      sourceId: input.sourceId,
      destinationId: input.destinationId,
      backupJobId: job.id,
      details: {
        selection: input.selection,
        sourceDirName: input.sourceDirName,
        items: countByStatus(input.items.map((item) => item.status)),
      },
    });

    return job;
  });

const countByStatus = (statuses: string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const status of statuses) counts[status] = (counts[status] ?? 0) + 1;

  return counts;
};

export const getBackupJob = async (
  db: Database | Tx,
  id: string,
): Promise<BackupJob | undefined> => {
  const [row] = await db.select().from(backupJobs).where(eq(backupJobs.id, id));

  return row;
};

export type ListBackupJobsOptions = {
  sourceId?: string;
  destinationId?: string;
  status?: BackupJobStatus;
  limit?: number;
};

const LIST_JOBS_DEFAULT_LIMIT = 50;
const LIST_JOBS_MAX_LIMIT = 200;

/** Newest first. */
export const listBackupJobs = async (
  db: Database,
  options: ListBackupJobsOptions = {},
): Promise<BackupJob[]> =>
  db
    .select()
    .from(backupJobs)
    .where(
      and(
        options.sourceId
          ? eq(backupJobs.sourceId, options.sourceId)
          : undefined,
        options.destinationId
          ? eq(backupJobs.destinationId, options.destinationId)
          : undefined,
        options.status ? eq(backupJobs.status, options.status) : undefined,
      ),
    )
    .orderBy(desc(backupJobs.createdAt), desc(backupJobs.id))
    .limit(
      Math.min(options.limit ?? LIST_JOBS_DEFAULT_LIMIT, LIST_JOBS_MAX_LIMIT),
    );

export type BackupItemCounts = Record<BackupJobItemStatus, number>;
export type BackupEntryCounts = Record<
  'pending' | 'verified' | 'failed' | 'not_followed',
  number
>;

export type BackupJobSummary = {
  itemCounts: BackupItemCounts;
  entryCounts: BackupEntryCounts;
  /** Bytes of verified file entries. */
  verifiedBytes: number;
  /** Sum of the items' size estimates; items without one count in `unestimatedItems`. */
  estimatedBytes: number;
  unestimatedItems: number;
  /** In-progress items whose lease has expired; the next claim reclaims them. */
  staleClaims: number;
  lastActivityAt: Date | null;
};

const emptyItemCounts = (): BackupItemCounts => ({
  queued: 0,
  in_progress: 0,
  verified: 0,
  failed: 0,
  blocked: 0,
  skipped: 0,
  excluded: 0,
});

/** Item counts by status for one job. */
export const getBackupItemCounts = async (
  db: Database | Tx,
  jobId: string,
): Promise<BackupItemCounts> => {
  const rows = await db
    .select({
      status: backupJobItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(backupJobItems)
    .where(eq(backupJobItems.jobId, jobId))
    .groupBy(backupJobItems.status);

  const counts = emptyItemCounts();
  for (const row of rows) counts[row.status] = row.count;

  return counts;
};

/**
 * Derived counts for several jobs in three queries, so lists of jobs need no
 * per-job round trip. Every requested id gets an entry. Counts are never
 * stored: they come from the items and entries.
 */
export const getBackupJobSummaries = async (
  db: Database | Tx,
  jobIds: string[],
): Promise<Map<string, BackupJobSummary>> => {
  const result = new Map<string, BackupJobSummary>();
  for (const id of jobIds) {
    result.set(id, {
      itemCounts: emptyItemCounts(),
      entryCounts: { pending: 0, verified: 0, failed: 0, not_followed: 0 },
      verifiedBytes: 0,
      estimatedBytes: 0,
      unestimatedItems: 0,
      staleClaims: 0,
      lastActivityAt: null,
    });
  }
  if (jobIds.length === 0) return result;

  const i = backupJobItems;
  const itemRows = await db
    .select({
      jobId: i.jobId,
      status: i.status,
      count: sql<number>`count(*)::int`,
      stale: sql<number>`(count(*) filter (where ${i.status} = 'in_progress' and ${i.leaseExpiresAt} < now()))::int`,
      estimated: sql<number>`coalesce(sum(${i.estimatedSizeBytes}) filter (where ${i.status} in ('queued', 'in_progress', 'verified', 'failed', 'blocked')), 0)::float8`,
      unestimated: sql<number>`(count(*) filter (where ${i.estimatedSizeBytes} is null and ${i.status} in ('queued', 'in_progress', 'verified', 'failed', 'blocked')))::int`,
      lastAt: sql<Date | null>`max(${i.updatedAt})`,
    })
    .from(i)
    .where(inArray(i.jobId, jobIds))
    .groupBy(i.jobId, i.status);

  for (const row of itemRows) {
    const summary = result.get(row.jobId) as BackupJobSummary;
    summary.itemCounts[row.status] = row.count;
    summary.staleClaims += row.stale;
    summary.estimatedBytes += row.estimated;
    summary.unestimatedItems += row.unestimated;
    if (row.lastAt) {
      const at = new Date(row.lastAt);
      if (!summary.lastActivityAt || at > summary.lastActivityAt) {
        summary.lastActivityAt = at;
      }
    }
  }

  const e = backupEntries;
  const entryRows = await db
    .select({
      jobId: i.jobId,
      status: e.status,
      count: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${e.sizeBytes}) filter (where ${e.entryType} = 'file'), 0)::float8`,
    })
    .from(e)
    .innerJoin(i, eq(i.id, e.jobItemId))
    .where(inArray(i.jobId, jobIds))
    .groupBy(i.jobId, e.status);

  for (const row of entryRows) {
    const summary = result.get(row.jobId) as BackupJobSummary;
    summary.entryCounts[row.status] = row.count;
    if (row.status === 'verified') summary.verifiedBytes += row.bytes;
  }

  return result;
};

/**
 * Cancels or fails an active job (human actions). Leases are released in the
 * same transaction: an in-progress item goes back to `queued` with no claim,
 * so a late worker is rejected (its token is gone) and the item stays on
 * record as work that was never finished. Queued, failed and blocked items
 * are left as they are.
 */
export const transitionBackupJob = async (
  db: Database,
  id: string,
  to: Extract<BackupJobStatus, 'failed' | 'cancelled'>,
  actor: Actor,
  error?: string,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(backupJobs)
      .set({
        status: to,
        error: error ?? null,
        stalledReason: null,
        stalledSince: null,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(backupJobs.id, id),
          inArray(backupJobs.status, ACTIVE_BACKUP_JOB_STATUSES),
        ),
      )
      .returning();

    if (!row) {
      const existing = await getBackupJob(tx, id);
      if (!existing) throw new BackupError('not_found', 'backup job not found');

      throw new BackupError(
        'conflict',
        `job is already ${existing.status}; cannot move to ${to}`,
      );
    }

    const t = backupJobItems;
    await tx
      .update(t)
      .set({
        status: 'queued',
        lastError: `job ${to}`,
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(t.jobId, id), eq(t.status, 'in_progress')));

    await insertAuditEvent(tx, {
      eventType: to === 'failed' ? 'backup_job.failed' : 'backup_job.cancelled',
      actor,
      sourceId: row.sourceId,
      destinationId: row.destinationId,
      backupJobId: id,
      details: error ? { error } : null,
    });

    return row;
  });

export type CompleteBackupJobResult = {
  job: BackupJob;
  /** False when the job was already final or still has queued or in-progress work. */
  finished: boolean;
};

/**
 * The final-outcome check, run when a claim finds `queue_empty`. Once no item
 * is `queued` or `in_progress` (after reclaiming expired leases) the job is
 * `completed` if every item is verified, skipped or excluded, and
 * `completed_with_issues` if any is failed or blocked. A completed job never
 * implies full coverage; that is the coverage report's job. Safe to call on a
 * job that is not done: it answers `finished: false` and changes nothing.
 */
export const completeBackupJobIfDone = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<CompleteBackupJobResult> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      return { job, finished: false };
    }

    await expireBackupLeases(tx, job.id);
    const counts = await getBackupItemCounts(tx, job.id);
    if (counts.queued > 0 || counts.in_progress > 0) {
      return { job, finished: false };
    }

    const status: BackupJobStatus =
      counts.failed > 0 || counts.blocked > 0
        ? 'completed_with_issues'
        : 'completed';

    const [done] = await tx
      .update(backupJobs)
      .set({
        status,
        stalledReason: null,
        stalledSince: null,
        startedAt: sql`coalesce(${backupJobs.startedAt}, now())`,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType:
        status === 'completed'
          ? 'backup_job.completed'
          : 'backup_job.completed_with_issues',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { items: counts },
    });

    return { job: done, finished: true };
  });

/**
 * Marks an active job stalled: claims are paused, no attempts are spent and
 * the job stays `running`. Audited when the job becomes stalled or its reason
 * changes, not on every repeat.
 */
export const stallBackupJob = async (
  db: Database,
  id: string,
  reason: BackupJobStalledReason,
  actor: Actor,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      throw new BackupError('conflict', `job is ${job.status}`);
    }
    if (job.stalledReason === reason) return job;

    const [row] = await tx
      .update(backupJobs)
      .set({
        stalledReason: reason,
        stalledSince: job.stalledReason ? backupJobs.stalledSince : sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_job.stalled',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { reason },
    });

    return row;
  });

/** Clears a stall once the destination or source answers again. */
export const resumeBackupJob = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!job.stalledReason) return job;

    const [row] = await tx
      .update(backupJobs)
      .set({ stalledReason: null, stalledSince: null, updatedAt: sql`now()` })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_job.resumed',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { wasStalledFor: job.stalledReason },
    });

    return row;
  });

/** Active jobs of a destination, oldest first: the order claims serve them. */
export const listActiveBackupJobs = async (
  db: Database | Tx,
  destinationId: string,
): Promise<BackupJob[]> =>
  db
    .select()
    .from(backupJobs)
    .where(
      and(
        eq(backupJobs.destinationId, destinationId),
        inArray(backupJobs.status, ACTIVE_BACKUP_JOB_STATUSES),
      ),
    )
    .orderBy(asc(backupJobs.createdAt), asc(backupJobs.id));
