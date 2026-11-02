'use server';

import type {
  InventoryItem,
  BackupDestination,
  BackupEntry,
  BackupEntryIssueKind,
  BackupEntryStatus,
  BackupJob,
  BackupJobItem,
  BackupPlan,
} from '../homelab-api';
import { type ActionResult, send, post, patch } from './request';

export async function validateBackupDestination(
  destinationId: string,
): Promise<ActionResult<BackupDestination>> {
  return post<BackupDestination>(
    `/backup-destinations/${destinationId}/validate`,
  );
}

export async function setBackupDestinationEnabled(
  destinationId: string,
  enabled: boolean,
): Promise<ActionResult<BackupDestination>> {
  return post<BackupDestination>(
    `/backup-destinations/${destinationId}/${enabled ? 'enable' : 'disable'}`,
  );
}

/**
 * Edits a destination. The API refuses a change to the export or folder (409)
 * while the destination has an active job or any verified item.
 */
export async function updateBackupDestination(
  destinationId: string,
  input: CreateBackupDestinationInput,
): Promise<ActionResult<BackupDestination>> {
  return patch<BackupDestination>(`/backup-destinations/${destinationId}`, {
    name: input.name,
    hostId: input.hostId,
    settings: { exportPath: input.exportPath },
    rootDir: input.rootDir || null,
  });
}

/** The dry run behind "Start backup job": writes nothing. */
export async function planBackupJob(
  sourceId: string,
  destinationId: string,
  inventoryItemIds?: string[],
): Promise<ActionResult<BackupPlan>> {
  return post<BackupPlan>(`/sources/${sourceId}/backup-jobs/plan`, {
    destinationId,
    inventoryItemIds,
  });
}

/** Plans again and inserts the job; the scope is frozen from here on. */
export async function createBackupJob(
  sourceId: string,
  destinationId: string,
  inventoryItemIds?: string[],
): Promise<ActionResult<BackupJob>> {
  return post<BackupJob>(`/sources/${sourceId}/backup-jobs`, {
    destinationId,
    inventoryItemIds,
  });
}

export interface BackupInventoryChoice {
  id: string;
  kind: InventoryItem['kind'];
  rootPath: string;
}

const BACKUP_CHOICE_LIMIT = 50;

/** Approved inventory items a backup job can be limited to, matching `q`. */
export async function listApprovedInventoryForBackup(
  sourceId: string,
  q: string,
): Promise<ActionResult<{ items: BackupInventoryChoice[]; total: number }>> {
  const params = new URLSearchParams({
    decision: 'approved',
    limit: String(BACKUP_CHOICE_LIMIT),
  });
  if (q.trim()) params.set('q', q.trim());

  const result = await send<{ items: InventoryItem[]; total: number }>(
    'GET',
    `/sources/${sourceId}/inventory-items?${params}`,
  );
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      total: result.data.total,
      items: result.data.items.map(({ id, kind, rootPath }) => ({
        id,
        kind,
        rootPath,
      })),
    },
  };
}

export async function cancelBackupJob(
  jobId: string,
): Promise<ActionResult<BackupJob>> {
  return post<BackupJob>(`/backup-jobs/${jobId}/cancel`);
}

export async function retryBackupJobItem(
  itemId: string,
): Promise<ActionResult<BackupJobItem>> {
  return post<BackupJobItem>(`/backup-job-items/${itemId}/retry`);
}

export async function retryFailedBackupItems(
  jobId: string,
): Promise<ActionResult<{ retried: number }>> {
  return post<{ retried: number }>(`/backup-jobs/${jobId}/retry-failed`);
}

/** Creates a new job from the failed and blocked items of a finished one. */
export async function rerunUnresolvedBackupJob(
  jobId: string,
): Promise<ActionResult<BackupJob>> {
  return post<BackupJob>(`/backup-jobs/${jobId}/rerun-unresolved`);
}

export interface BackupEntryFilter {
  status?: BackupEntryStatus;
  issueKind?: BackupEntryIssueKind;
  /** The `next` of the previous page. */
  after?: number;
}

/** One page of a job item's per-file results; loaded on demand. */
export async function listBackupEntries(
  itemId: string,
  filter: BackupEntryFilter,
): Promise<ActionResult<{ entries: BackupEntry[]; next: number | null }>> {
  const query = new URLSearchParams({ limit: '200' });

  if (filter.status) query.set('status', filter.status);
  if (filter.issueKind) query.set('issueKind', filter.issueKind);
  if (filter.after !== undefined) query.set('after', String(filter.after));

  return send('GET', `/backup-job-items/${itemId}/entries?${query}`);
}

export interface CreateBackupDestinationInput {
  name: string;
  hostId: string;
  exportPath: string;
  /** Folder under the mount; omit for the mount root. */
  rootDir?: string;
}

/** Registers an NFS destination. Where it is mounted is the worker's environment, not this. */
export async function createBackupDestination(
  input: CreateBackupDestinationInput,
): Promise<ActionResult<BackupDestination>> {
  return post<BackupDestination>('/backup-destinations', {
    name: input.name,
    hostId: input.hostId,
    settings: { exportPath: input.exportPath },
    rootDir: input.rootDir || null,
  });
}
