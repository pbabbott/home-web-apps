import {
  DiscoveryError,
  claimNextQueueItem,
  completeQueueItem,
  enqueueQueueItems,
  failQueueItem,
  getQueueItemById,
  getSourceById,
  heartbeatQueueItem,
  listQueueItems as listQueueItemRows,
  retryQueueItem,
  skipQueueItem,
  type ClaimQueueItemResult,
  type DiscoveryJob,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type QueuePath,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { isWithinPath } from '../../lib/windows-path';
import { requireJob } from './discovery-jobs';
import { toQueuePath } from './paths';

export type QueueItemWithCreated = {
  item: DiscoveryQueueItem;
  created: boolean;
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
): Promise<ClaimQueueItemResult> =>
  claimNextQueueItem(db, { jobId, workerId, leaseSeconds });

export async function listSourceQueueItems(
  sourceId: string,
  filters: { status?: DiscoveryQueueItemStatus; jobId?: string },
): Promise<DiscoveryQueueItem[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
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

export async function listJobQueueItems(
  jobId: string,
  filters: { status?: DiscoveryQueueItemStatus },
): Promise<DiscoveryQueueItem[]> {
  await requireJob(jobId);

  return listQueueItemRows(db, { jobId, ...filters });
}
