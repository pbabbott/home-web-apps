import {
  DiscoveryError,
  claimNextQueueItem,
  completeDiscoveryJob,
  completeQueueItem,
  createBackupSource as createBackupSourceRow,
  createDiscoveryJob as createDiscoveryJobRow,
  enqueueQueueItems,
  failQueueItem,
  getBackupSourceById,
  getDiscoveryJobById,
  getQueueCounts,
  getQueueItemById,
  heartbeatQueueItem,
  listBackupSources as listBackupSourceRows,
  listAllDiscoveryJobs as listAllDiscoveryJobRows,
  listDiscoveryJobs as listDiscoveryJobRows,
  listQueueItems as listQueueItemRows,
  retryQueueItem,
  skipQueueItem,
  transitionDiscoveryJob,
  type BackupSource,
  type CreateBackupSourceInput,
  type DiscoveryJob,
  type DiscoveryJobWithSource,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type QueueCounts,
  type QueuePath,
} from '@abbottland/homelab-db';
import { db } from '../db';
import { isWithinPath, normalizeWindowsPath } from '../lib/windows-path';

export { DiscoveryError };

export type DiscoveryJobWithCounts = DiscoveryJob & {
  /** Source-wide item counts by status; `failed` > 0 means "finished with failures". */
  queueCounts: QueueCounts;
};

export type QueueItemWithCreated = {
  item: DiscoveryQueueItem;
  created: boolean;
};

const toQueuePath = (path: string): QueuePath => normalizeWindowsPath(path);

const withCounts = async (
  job: DiscoveryJob,
): Promise<DiscoveryJobWithCounts> => ({
  ...job,
  queueCounts: await getQueueCounts(db, job.sourceId),
});

const requireJob = async (id: string): Promise<DiscoveryJob> => {
  const job = await getDiscoveryJobById(db, id);
  if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

  return job;
};

/** Every path must sit under the job's root; the directory walk never leaves it. */
const assertWithinJobRoot = (job: DiscoveryJob, paths: QueuePath[]): void => {
  const outside = paths.filter(
    (p) => !isWithinPath(job.normalizedRootPath, p.normalizedPath),
  );

  if (outside.length > 0) {
    throw new DiscoveryError(
      'conflict',
      `paths are outside the job root ${job.rootPath}`,
      { paths: outside.map((p) => p.path) },
    );
  }
};

export const createBackupSource = (
  input: CreateBackupSourceInput,
): Promise<BackupSource> => createBackupSourceRow(db, input);

export const listBackupSources = (): Promise<BackupSource[]> =>
  listBackupSourceRows(db);

export async function createDiscoveryJob(
  sourceId: string,
  rootPath: string,
): Promise<DiscoveryJobWithCounts> {
  const job = await createDiscoveryJobRow(db, {
    sourceId,
    root: toQueuePath(rootPath),
  });

  return withCounts(job);
}

export const listAllJobs = (
  sourceId?: string,
): Promise<DiscoveryJobWithSource[]> =>
  listAllDiscoveryJobRows(db, { sourceId });

export async function listSourceJobs(
  sourceId: string,
): Promise<DiscoveryJob[]> {
  if (!(await getBackupSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'backup source not found');
  }

  return listDiscoveryJobRows(db, sourceId);
}

export async function getDiscoveryJob(
  id: string,
): Promise<DiscoveryJobWithCounts> {
  return withCounts(await requireJob(id));
}

export async function completeJob(id: string): Promise<DiscoveryJobWithCounts> {
  return withCounts(await completeDiscoveryJob(db, id));
}

export async function cancelJob(id: string): Promise<DiscoveryJobWithCounts> {
  return withCounts(await transitionDiscoveryJob(db, id, 'cancelled'));
}

export async function failJob(
  id: string,
  error: string,
): Promise<DiscoveryJobWithCounts> {
  return withCounts(await transitionDiscoveryJob(db, id, 'failed', error));
}

export async function enqueuePaths(
  jobId: string,
  paths: string[],
  priority: number,
): Promise<QueueItemWithCreated[]> {
  const job = await requireJob(jobId);
  const queuePaths = paths.map(toQueuePath);
  assertWithinJobRoot(job, queuePaths);

  return enqueueQueueItems(db, { jobId, paths: queuePaths, priority });
}

export const claimQueueItem = (
  jobId: string,
  workerId: string,
  leaseSeconds: number,
) => claimNextQueueItem(db, { jobId, workerId, leaseSeconds });

export async function listSourceQueueItems(
  sourceId: string,
  filters: { status?: DiscoveryQueueItemStatus; jobId?: string },
): Promise<DiscoveryQueueItem[]> {
  if (!(await getBackupSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'backup source not found');
  }

  return listQueueItemRows(db, { sourceId, ...filters });
}

export const heartbeat = (
  id: string,
  claimToken: string,
  leaseSeconds: number,
) => heartbeatQueueItem(db, id, { claimToken, leaseSeconds });

export async function completeItem(
  id: string,
  claimToken: string,
  discoveredPaths: string[],
) {
  const queuePaths = discoveredPaths.map(toQueuePath);

  if (queuePaths.length > 0) {
    const item = await getQueueItemById(db, id);
    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    if (item.jobId)
      assertWithinJobRoot(await requireJob(item.jobId), queuePaths);
  }

  return completeQueueItem(db, id, { claimToken, discoveredPaths: queuePaths });
}

export const failItem = (
  id: string,
  claimToken: string,
  error: string,
  retryable: boolean,
) => failQueueItem(db, id, { claimToken, error, retryable });

export const skipItem = (id: string, claimToken: string, reason: string) =>
  skipQueueItem(db, id, { claimToken, reason });

export const retryItem = (id: string) => retryQueueItem(db, id);
