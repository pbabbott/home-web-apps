import {
  BackupError,
  emptyBackupJobSummary,
  getBackupEntryCounts,
  getBackupJob,
  getBackupJobItem,
  getBackupJobScopeRootPaths,
  getBackupJobSummaries,
  listBackupEntries,
  listBackupJobItems,
  listBackupJobs,
  retryBackupJobItem,
  retryFailedBackupJobItems,
  transitionBackupJob,
  type Actor,
  type BackupEntry,
  type BackupItemEntryCounts,
  type BackupJob,
  type BackupJobItem,
  type BackupJobSummary,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import type {
  BackupEntryListQuery,
  BackupJobItemListQuery,
  BackupJobListQuery,
} from '../../schemas/backup/jobs';
import { createJob } from './planning';

/** What a job was asked to cover, read from its frozen selection. */
export type BackupJobScope =
  | { type: 'source' }
  | { type: 'rerun'; fromJobId: string }
  | { type: 'inventory'; itemCount: number; rootPath: string | null };

/** A job with its derived progress: counts come from the items and entries, never stored. */
export type BackupJobView = BackupJob & {
  progress: BackupJobSummary;
  scope: BackupJobScope;
};

/** An item without its claim token: nobody but the worker that holds the lease needs it. */
export type BackupJobItemView = Omit<BackupJobItem, 'claimToken'>;

const toItemView = (item: BackupJobItem): BackupJobItemView => {
  const view: Partial<BackupJobItem> = { ...item };
  delete view.claimToken;

  return view as BackupJobItemView;
};

const scopeOf = (job: BackupJob, rootPath: string | null): BackupJobScope => {
  const { fromJobId, inventoryItemIds } = job.selection;

  if (fromJobId) return { type: 'rerun', fromJobId };
  if (inventoryItemIds?.length) {
    return { type: 'inventory', itemCount: inventoryItemIds.length, rootPath };
  }

  return { type: 'source' };
};

const withProgress = async (jobs: BackupJob[]): Promise<BackupJobView[]> => {
  const ids = jobs.map((j) => j.id);
  const [summaries, rootPaths] = await Promise.all([
    getBackupJobSummaries(db, ids),
    getBackupJobScopeRootPaths(db, ids),
  ]);

  return jobs.map((job) => {
    return {
      ...job,
      progress: summaries.get(job.id) ?? emptyBackupJobSummary(),
      scope: scopeOf(job, rootPaths.get(job.id) ?? null),
    };
  });
};

const requireJob = async (id: string): Promise<BackupJob> => {
  const job = await getBackupJob(db, id);
  if (!job) throw new BackupError('not_found', 'backup job not found');

  return job;
};

const requireItem = async (id: string): Promise<BackupJobItem> => {
  const item = await getBackupJobItem(db, id);
  if (!item) throw new BackupError('not_found', 'backup job item not found');

  return item;
};

export async function listJobs(
  query: BackupJobListQuery,
): Promise<BackupJobView[]> {
  return withProgress(await listBackupJobs(db, query));
}

export async function getJob(id: string): Promise<BackupJobView> {
  return (await withProgress([await requireJob(id)]))[0];
}

export async function cancelJob(
  id: string,
  actor: Actor,
): Promise<BackupJobView> {
  return (
    await withProgress([await transitionBackupJob(db, id, 'cancelled', actor)])
  )[0];
}

export async function failJob(
  id: string,
  error: string,
  actor: Actor,
): Promise<BackupJobView> {
  return (
    await withProgress([
      await transitionBackupJob(db, id, 'failed', actor, error),
    ])
  )[0];
}

export async function retryFailedItems(
  id: string,
  actor: Actor,
): Promise<{ retried: number; items: BackupJobItemView[] }> {
  const items = await retryFailedBackupJobItems(db, id, actor);

  return { retried: items.length, items: items.map(toItemView) };
}

/**
 * A new job for the failed and blocked items of a finished job. It goes
 * through the normal planning, so anything that was verified in the meantime
 * is skipped and the current inventory decisions apply. The job keeps a
 * reference to the one it reruns, not the list of items.
 */
export async function rerunUnresolved(
  id: string,
  actor: Actor,
): Promise<BackupJob> {
  const job = await requireJob(id);

  return createJob(
    job.sourceId,
    {
      destinationId: job.destinationId,
      fromJobId: id,
      skipAlreadyCovered: true,
    },
    actor,
  );
}

export async function listJobItems(
  jobId: string,
  query: BackupJobItemListQuery,
): Promise<{ items: BackupJobItemView[]; next: string | null }> {
  await requireJob(jobId);
  const items = await listBackupJobItems(db, { jobId, ...query });

  return {
    items: items.map(toItemView),
    next:
      items.length === query.limit
        ? items[items.length - 1].normalizedRootPath
        : null,
  };
}

export async function getJobItem(
  id: string,
): Promise<BackupJobItemView & { entryCounts: BackupItemEntryCounts }> {
  const item = await requireItem(id);

  return {
    ...toItemView(item),
    entryCounts: await getBackupEntryCounts(db, id),
  };
}

export async function listItemEntries(
  jobItemId: string,
  query: BackupEntryListQuery,
): Promise<{ entries: BackupEntry[]; next: number | null }> {
  await requireItem(jobItemId);
  const entries = await listBackupEntries(db, { jobItemId, ...query });

  return {
    entries,
    next:
      entries.length === query.limit ? entries[entries.length - 1].id : null,
  };
}

export async function retryItem(
  id: string,
  actor: Actor,
): Promise<BackupJobItemView> {
  return toItemView(await retryBackupJobItem(db, id, actor));
}
