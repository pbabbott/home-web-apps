import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupEntries,
  backupJobItems,
  type BackupJobItemStatus,
} from '../../schema/backup';
import type { Tx } from '../shared';

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

/** The summary of a job that has no items yet. */
export const emptyBackupJobSummary = (): BackupJobSummary => ({
  itemCounts: emptyItemCounts(),
  entryCounts: { pending: 0, verified: 0, failed: 0, not_followed: 0 },
  verifiedBytes: 0,
  estimatedBytes: 0,
  unestimatedItems: 0,
  staleClaims: 0,
  lastActivityAt: null,
});

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
  for (const id of jobIds) result.set(id, emptyBackupJobSummary());
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
