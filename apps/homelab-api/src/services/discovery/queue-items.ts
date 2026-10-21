import {
  DiscoveryError,
  claimNextQueueItem,
  completeQueueItem,
  enqueueQueueItems,
  failQueueItem,
  getQueueItemById,
  getSourceById,
  heartbeatQueueItem,
  listKnownSkips as listKnownSkipRows,
  listQueueItems as listQueueItemRows,
  retryQueueItem,
  skipQueueItem,
  type ClaimQueueItemResult,
  type DiscoveryJob,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type KnownSkip,
  type QueuePath,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { isWithinPath, normalizeWindowsPath } from '../../lib/windows-path';
import { requireJob } from './discovery-jobs';
import { toFollowUpPath, toQueuePath, type FollowUpInput } from './paths';

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
  discoveredPaths: FollowUpInput[],
  outcome: {
    summary?: string;
    skipped?: { path: string; reason: string }[];
    skippedGroups?: { pattern: string; count?: number; reason: string }[];
  } = {},
) {
  const queuePaths = discoveredPaths.map(toFollowUpPath);
  const skipped = (outcome.skipped ?? []).map((s) => ({
    ...normalizeWindowsPath(s.path),
    reason: s.reason,
  }));

  if (queuePaths.length > 0 || skipped.length > 0) {
    const item = await getQueueItemById(db, id);
    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    assertWithinJobRoot(await requireJob(item.jobId), queuePaths);

    const outside = skipped.filter(
      (s) =>
        s.normalizedPath === item.normalizedPath ||
        !isWithinPath(item.normalizedPath, s.normalizedPath),
    );
    if (outside.length > 0) {
      throw new DiscoveryError(
        'conflict',
        `skipped paths are not inside the claimed directory ${item.path}`,
        { paths: outside.map((s) => s.path) },
      );
    }
  }

  const skippedGroups = outcome.skippedGroups ?? [];
  const hasResult =
    outcome.summary !== undefined ||
    skipped.length > 0 ||
    skippedGroups.length > 0;

  return completeQueueItem(db, id, {
    claimToken,
    discoveredPaths: queuePaths,
    result: hasResult
      ? {
          ...(outcome.summary ? { summary: outcome.summary } : {}),
          skipped: skipped.map((s) => ({ path: s.path, reason: s.reason })),
          ...(skippedGroups.length > 0 ? { skippedGroups } : {}),
        }
      : undefined,
  });
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

/**
 * Paths earlier jobs of the source chose not to explore, newest reason per
 * path. A per-run judgment the agent may revisit, not an exclusion rule.
 */
export async function listSourceKnownSkips(
  sourceId: string,
  filters: { pathPrefix?: string; limit?: number },
): Promise<KnownSkip[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listKnownSkipRows(db, {
    sourceId,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    limit: filters.limit,
  });
}
