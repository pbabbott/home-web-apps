import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { isUniqueViolation } from '../../pg-errors';
import {
  backupDestinations,
  backupJobItems,
  backupJobs,
  type BackupCarveOut,
  type BackupJob,
  type BackupJobItemStatus,
  type BackupJobSelection,
  type BackupJobStatus,
} from '../../schema/backup';
import type { InventoryItemKind } from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import type { Tx } from '../shared';
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

/**
 * The inventory items behind the `failed` and `blocked` items of a job: what
 * a rerun of the job covers. Resolved here so a job never has to carry the
 * list in its selection.
 */
export const listUnresolvedInventoryItemIds = async (
  db: Database | Tx,
  jobId: string,
): Promise<string[]> => {
  const t = backupJobItems;
  const rows = await db
    .selectDistinct({ id: t.inventoryItemId })
    .from(t)
    .where(
      and(
        eq(t.jobId, jobId),
        inArray(t.status, ['failed', 'blocked']),
        isNotNull(t.inventoryItemId),
      ),
    );

  return rows.flatMap((r) => (r.id ? [r.id] : []));
};

/**
 * The root path of the one inventory item each single-item job was made for,
 * keyed by job id. Jobs of any other scope get no entry.
 */
export const getBackupJobScopeRootPaths = async (
  db: Database | Tx,
  jobIds: string[],
): Promise<Map<string, string>> => {
  if (jobIds.length === 0) return new Map();

  const rows = await db
    .select({ jobId: backupJobs.id, rootPath: backupJobItems.rootPath })
    .from(backupJobs)
    .innerJoin(
      backupJobItems,
      and(
        eq(backupJobItems.jobId, backupJobs.id),
        sql`${backupJobItems.inventoryItemId}::text = ${backupJobs.selection}->'inventoryItemIds'->>0`,
      ),
    )
    .where(
      and(
        inArray(backupJobs.id, jobIds),
        sql`jsonb_array_length(coalesce(${backupJobs.selection}->'inventoryItemIds', '[]'::jsonb)) = 1`,
      ),
    );

  return new Map(rows.map((r) => [r.jobId, r.rootPath]));
};
