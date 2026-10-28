import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { Database } from '../../client';
import { backupJobItems, backupJobs } from '../../schema/backup';

/**
 * The destination folder each source already uses at a destination, taken
 * from its latest job. Planning reuses a source's folder and refuses a name
 * another source has taken.
 */
export const getBackupSourceDirNames = async (
  db: Database,
  destinationId: string,
): Promise<{ sourceId: string; sourceDirName: string }[]> => {
  const rows = await db
    .selectDistinctOn([backupJobs.sourceId], {
      sourceId: backupJobs.sourceId,
      sourceDirName: backupJobs.sourceDirName,
    })
    .from(backupJobs)
    .where(eq(backupJobs.destinationId, destinationId))
    .orderBy(backupJobs.sourceId, desc(backupJobs.createdAt));

  return rows;
};

/**
 * The destination path of every inventory item of a source that already has a
 * verified job item at a destination. A new job reuses it, so a changed
 * spelling of the path cannot split the tree.
 */
export const getPriorVerifiedDestRelPaths = async (
  db: Database,
  sourceId: string,
  destinationId: string,
): Promise<Map<string, string>> => {
  const rows = await db
    .select({
      inventoryItemId: backupJobItems.inventoryItemId,
      destRelPath: backupJobItems.destRelPath,
    })
    .from(backupJobItems)
    .innerJoin(backupJobs, eq(backupJobs.id, backupJobItems.jobId))
    .where(
      and(
        eq(backupJobs.sourceId, sourceId),
        eq(backupJobs.destinationId, destinationId),
        eq(backupJobItems.status, 'verified'),
        isNotNull(backupJobItems.inventoryItemId),
      ),
    )
    .orderBy(backupJobItems.completedAt);

  return new Map(rows.map((r) => [r.inventoryItemId as string, r.destRelPath]));
};
