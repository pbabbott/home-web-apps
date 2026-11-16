import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupDestinations,
  backupEntries,
  backupJobItems,
  backupJobs,
  type BackupDestination,
  type BackupEntry,
  type BackupJob,
  type BackupJobItem,
  type NewBackupDestination,
} from '../../schema/backup';
import { inventoryItems } from '../../schema/discovery';

// Job items and entries carry ~25 columns each; 500 rows stays well under
// Postgres' 65535 bind-parameter limit.
const IMPORT_CHUNK_SIZE = 500;

const chunk = <T>(rows: T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + IMPORT_CHUNK_SIZE));
  }

  return chunks;
};

/**
 * Upserts destinations by `name` (unique) and returns the local rows; the
 * local `id` may differ from the imported one, so callers remap
 * `destinationId` on jobs. Worker lease fields are never imported: a
 * destination's claim belongs to the environment whose worker took it.
 */
export const importBackupDestinations = async (
  db: Database,
  rows: Omit<NewBackupDestination, 'id' | 'claimedBy' | 'claimedUntil'>[],
): Promise<BackupDestination[]> => {
  if (rows.length === 0) return [];

  return db
    .insert(backupDestinations)
    .values(rows)
    .onConflictDoUpdate({
      target: backupDestinations.name,
      set: {
        hostId: sql`excluded.host_id`,
        connectionType: sql`excluded.connection_type`,
        settings: sql`excluded.settings`,
        rootDir: sql`excluded.root_dir`,
        enabled: sql`excluded.enabled`,
        health: sql`excluded.health`,
        lastValidatedAt: sql`excluded.last_validated_at`,
        lastValidation: sql`excluded.last_validation`,
        validationRequestedAt: sql`excluded.validation_requested_at`,
        workerSeenAt: sql`excluded.worker_seen_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();
};

/**
 * Upserts jobs by `id`, preserving imported ids so items still line up. The
 * source and destination must already be imported and remapped.
 */
export const importBackupJobs = async (
  db: Database,
  rows: BackupJob[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(backupJobs)
      .values(batch)
      .onConflictDoUpdate({
        target: backupJobs.id,
        set: {
          sourceId: sql`excluded.source_id`,
          destinationId: sql`excluded.destination_id`,
          status: sql`excluded.status`,
          stalledReason: sql`excluded.stalled_reason`,
          stalledSince: sql`excluded.stalled_since`,
          selection: sql`excluded.selection`,
          sourceDirName: sql`excluded.source_dir_name`,
          error: sql`excluded.error`,
          createdBy: sql`excluded.created_by`,
          startedAt: sql`excluded.started_at`,
          finishedAt: sql`excluded.finished_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/**
 * Upserts job items by `id`. The API never returns `claimToken`, but an
 * in-progress item must have one (check constraint), so callers pass a
 * placeholder. `coveredByJobItemId` points at a sibling item, so it is set
 * in a second pass once every row of the batch exists.
 */
export const importBackupJobItems = async (
  db: Database,
  rows: BackupJobItem[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(backupJobItems)
      .values(batch.map((row) => ({ ...row, coveredByJobItemId: null })))
      .onConflictDoUpdate({
        target: backupJobItems.id,
        set: {
          inventoryItemId: sql`excluded.inventory_item_id`,
          kind: sql`excluded.kind`,
          rootPath: sql`excluded.root_path`,
          normalizedRootPath: sql`excluded.normalized_root_path`,
          destRelPath: sql`excluded.dest_rel_path`,
          carveOuts: sql`excluded.carve_outs`,
          estimatedSizeBytes: sql`excluded.estimated_size_bytes`,
          status: sql`excluded.status`,
          statusReason: sql`excluded.status_reason`,
          attemptCount: sql`excluded.attempt_count`,
          maxAttempts: sql`excluded.max_attempts`,
          availableAt: sql`excluded.available_at`,
          claimedBy: sql`excluded.claimed_by`,
          lastClaimedBy: sql`excluded.last_claimed_by`,
          claimToken: sql`excluded.claim_token`,
          leaseExpiresAt: sql`excluded.lease_expires_at`,
          lastError: sql`excluded.last_error`,
          enumerationComplete: sql`excluded.enumeration_complete`,
          enumeratedAt: sql`excluded.enumerated_at`,
          startedAt: sql`excluded.started_at`,
          completedAt: sql`excluded.completed_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/** Second pass of the item import, once the covering siblings exist. */
export const linkBackupJobItemCoverage = async (
  db: Database,
  rows: Pick<BackupJobItem, 'id' | 'coveredByJobItemId'>[],
): Promise<void> => {
  for (const row of rows) {
    if (!row.coveredByJobItemId) continue;
    await db
      .update(backupJobItems)
      .set({ coveredByJobItemId: row.coveredByJobItemId })
      .where(eq(backupJobItems.id, row.id));
  }
};

/**
 * Upserts entries by `(jobItemId, normalizedRelPath)`. The `id` is an
 * identity column that cannot be set, so it is dropped and local ids are
 * assigned in insertion order.
 */
export const importBackupEntries = async (
  db: Database,
  rows: BackupEntry[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(backupEntries)
      .values(
        batch.map((entry) => {
          const row: Partial<BackupEntry> = { ...entry };
          delete row.id;

          return row as Omit<BackupEntry, 'id'>;
        }),
      )
      .onConflictDoUpdate({
        target: [backupEntries.jobItemId, backupEntries.normalizedRelPath],
        set: {
          relPath: sql`excluded.rel_path`,
          entryType: sql`excluded.entry_type`,
          status: sql`excluded.status`,
          issueKind: sql`excluded.issue_kind`,
          message: sql`excluded.message`,
          sizeBytes: sql`excluded.size_bytes`,
          sha256: sql`excluded.sha256`,
          destRelPath: sql`excluded.dest_rel_path`,
          srcCreatedAt: sql`excluded.src_created_at`,
          srcModifiedAt: sql`excluded.src_modified_at`,
          srcAccessedAt: sql`excluded.src_accessed_at`,
          srcChangedAt: sql`excluded.src_changed_at`,
          srcAttributes: sql`excluded.src_attributes`,
          srcStreams: sql`excluded.src_streams`,
          srcZoneIdentifier: sql`excluded.src_zone_identifier`,
          attempt: sql`excluded.attempt`,
          verifiedAt: sql`excluded.verified_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/** Local inventory ids and paths of a source, to remap imported job items. */
export const listInventoryKeysForImport = async (
  db: Database,
  sourceId: string,
): Promise<{ id: string; normalizedRootPath: string }[]> =>
  db
    .select({
      id: inventoryItems.id,
      normalizedRootPath: inventoryItems.normalizedRootPath,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.sourceId, sourceId));
