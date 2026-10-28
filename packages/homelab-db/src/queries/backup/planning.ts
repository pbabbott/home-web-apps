import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { backupJobItems, backupJobs } from '../../schema/backup';
import {
  inventoryItems,
  type InventoryItemDecision,
  type InventoryItemKind,
} from '../../schema/discovery';

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

export type BackupPlanningInventoryItem = {
  id: string;
  kind: InventoryItemKind;
  rootPath: string;
  normalizedRootPath: string;
  decision: InventoryItemDecision;
  /** From the discovery evidence; null when the agent gave no estimate. */
  estimatedSizeBytes: number | null;
};

/** Every inventory item of a source, in path order: all planning needs to read. */
export const listInventoryForBackupPlanning = async (
  db: Database,
  sourceId: string,
): Promise<BackupPlanningInventoryItem[]> => {
  const t = inventoryItems;

  return db
    .select({
      id: t.id,
      kind: t.kind,
      rootPath: t.rootPath,
      normalizedRootPath: t.normalizedRootPath,
      decision: t.decision,
      estimatedSizeBytes: sql<
        number | null
      >`(${t.evidence}->>'estimatedSizeBytes')::float8`,
    })
    .from(t)
    .where(eq(t.sourceId, sourceId))
    .orderBy(asc(t.normalizedRootPath));
};
