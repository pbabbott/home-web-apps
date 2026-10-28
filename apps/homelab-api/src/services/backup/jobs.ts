import {
  BackupError,
  getBackupEntryCounts,
  getBackupJob,
  getBackupJobItem,
  getBackupJobSummaries,
  listBackupEntries,
  listBackupJobItems,
  listBackupJobs,
  retryBackupJobItem,
  retryFailedBackupJobItems,
  transitionBackupJob,
  ACTIVE_BACKUP_JOB_STATUSES,
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

/** A job with its derived progress: counts come from the items and entries, never stored. */
export type BackupJobView = BackupJob & { progress: BackupJobSummary };

/** An item without its claim token: nobody but the worker that holds the lease needs it. */
export type BackupJobItemView = Omit<BackupJobItem, 'claimToken'>;

const toItemView = (item: BackupJobItem): BackupJobItemView => {
  const view: Partial<BackupJobItem> = { ...item };
  delete view.claimToken;

  return view as BackupJobItemView;
};

const withProgress = async (jobs: BackupJob[]): Promise<BackupJobView[]> => {
  const summaries = await getBackupJobSummaries(
    db,
    jobs.map((j) => j.id),
  );

  return jobs.map((job) => ({
    ...job,
    progress: summaries.get(job.id) as BackupJobSummary,
  }));
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

const RERUN_PAGE = 500;

/**
 * A new job for the failed and blocked items of a finished job. It goes
 * through the normal planning, so anything that was verified in the meantime
 * is skipped and the current inventory decisions apply.
 */
export async function rerunUnresolved(
  id: string,
  actor: Actor,
): Promise<BackupJob> {
  const job = await requireJob(id);
  if (ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
    throw new BackupError(
      'conflict',
      `job is ${job.status}; retry its items instead of rerunning it`,
    );
  }

  const inventoryItemIds: string[] = [];
  for (const status of ['failed', 'blocked'] as const) {
    let after: string | undefined;
    for (;;) {
      const page = await listBackupJobItems(db, {
        jobId: id,
        status,
        after,
        limit: RERUN_PAGE,
      });
      for (const item of page) {
        if (item.inventoryItemId) inventoryItemIds.push(item.inventoryItemId);
      }
      if (page.length < RERUN_PAGE) break;
      after = page[page.length - 1].normalizedRootPath;
    }
  }

  if (inventoryItemIds.length === 0) {
    throw new BackupError(
      'conflict',
      'the job has no failed or blocked items to rerun',
    );
  }

  return createJob(
    job.sourceId,
    {
      destinationId: job.destinationId,
      inventoryItemIds,
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
