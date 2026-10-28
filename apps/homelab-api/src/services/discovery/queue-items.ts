import {
  DiscoveryError,
  claimNextAcrossJobs,
  claimNextQueueItem,
  completeQueueItem,
  enqueueQueueItems,
  failQueueItem,
  getQueueCounts,
  getQueueItemById,
  getQueueItemWithJob,
  getSourceById,
  getOnDiskReview,
  listAcknowledgedSkipKeys,
  listOnDiskReviewedPaths,
  listInventoriedPaths,
  listInventoryItems as listInventoryItemRows,
  heartbeatQueueItem,
  listKnownSkips as listKnownSkipRows,
  listQueueItems as listQueueItemRows,
  releaseQueueItem,
  retryFailedQueueItems,
  retryQueueItem,
  skipQueueItem,
  type ClaimQueueItemResult,
  type DiscoveryJob,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type KnownSkip,
  type QueueItemWithInventoryCount,
  type QueuePath,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { isWithinPath, normalizeWindowsPath } from '@abbottland/source-access';
import { requireJob } from './discovery-jobs';
import {
  directoryReviewed,
  reviewSkips,
  type ReviewContext,
  type SkipReview,
} from './skip-review';
import {
  assertWithinClaimedDirectory,
  toFollowUpPath,
  toQueuePath,
  type FollowUpInput,
} from './paths';

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

export const claimAnyQueueItem = (
  workerId: string,
  leaseSeconds: number,
  sourceId?: string,
): Promise<ClaimQueueItemResult> =>
  claimNextAcrossJobs(db, { workerId, leaseSeconds, sourceId });

export async function listSourceQueueItems(
  sourceId: string,
  filters: { status?: DiscoveryQueueItemStatus; jobId?: string },
): Promise<QueueItemWithInventoryCount[]> {
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
    unreadable?: { path: string; error: string }[];
  } = {},
) {
  const queuePaths = discoveredPaths.map(toFollowUpPath);
  const skipped = (outcome.skipped ?? []).map((s) => ({
    ...normalizeWindowsPath(s.path),
    reason: s.reason,
  }));

  const unreadable = (outcome.unreadable ?? []).map((u) => ({
    ...normalizeWindowsPath(u.path),
    error: u.error,
  }));
  const unreadablePaths: QueuePath[] = unreadable.map((u) => ({
    path: u.path,
    normalizedPath: u.normalizedPath,
    failure: u.error,
  }));

  if (queuePaths.length > 0 || skipped.length > 0 || unreadable.length > 0) {
    const item = await getQueueItemById(db, id);
    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    assertWithinJobRoot(await requireJob(item.jobId), queuePaths);

    assertWithinClaimedDirectory(item, skipped, {
      allowSelf: false,
      subject: 'skipped paths',
    });
    assertWithinClaimedDirectory(item, unreadable, {
      allowSelf: false,
      subject: 'unreadable paths',
    });
  }

  const skippedGroups = outcome.skippedGroups ?? [];
  const hasResult =
    outcome.summary !== undefined ||
    skipped.length > 0 ||
    skippedGroups.length > 0 ||
    unreadable.length > 0;

  return completeQueueItem(db, id, {
    claimToken,
    discoveredPaths: queuePaths,
    unreadablePaths,
    result: hasResult
      ? {
          ...(outcome.summary ? { summary: outcome.summary } : {}),
          skipped: skipped.map((s) => ({ path: s.path, reason: s.reason })),
          ...(skippedGroups.length > 0 ? { skippedGroups } : {}),
          ...(unreadable.length > 0
            ? {
                unreadable: unreadable.map((u) => ({
                  path: u.path,
                  error: u.error,
                })),
              }
            : {}),
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

export const jobQueueCounts = (jobId: string) => getQueueCounts(db, jobId);

export const releaseItem = (id: string, claimToken: string) =>
  releaseQueueItem(db, id, { claimToken });

export const retryFailedItems = (jobId: string) =>
  retryFailedQueueItems(db, jobId);

export const retryItem = (id: string) => retryQueueItem(db, id);

/** Reads the acknowledgements, inventory paths and on-disk reviews beneath `rootPath` once, for reviewing many directories. */
async function loadReviewContext(
  sourceId: string,
  rootPath: string,
): Promise<ReviewContext & { onDiskReviewed: ReadonlySet<string> }> {
  const { normalizedPath } = normalizeWindowsPath(rootPath);
  const [acknowledged, inventoried, onDiskReviewed] = await Promise.all([
    listAcknowledgedSkipKeys(db, sourceId, normalizedPath),
    listInventoriedPaths(db, sourceId, normalizedPath),
    listOnDiskReviewedPaths(db, sourceId, normalizedPath),
  ]);

  return {
    acknowledged: new Set(acknowledged),
    inventoried: new Set(inventoried),
    onDiskReviewed: new Set(onDiskReviewed),
  };
}

export type QueueItemListEntry = QueueItemWithInventoryCount & {
  /** Every skip reviewed, no inventory decision pending and the on-disk contents acknowledged; null until the directory has a result. */
  reviewed: boolean | null;
};

export async function listJobQueueItems(
  jobId: string,
  filters: { status?: DiscoveryQueueItemStatus },
): Promise<QueueItemListEntry[]> {
  const job = await requireJob(jobId);
  const [items, context] = await Promise.all([
    listQueueItemRows(db, { jobId, ...filters }),
    loadReviewContext(job.sourceId, job.rootPath),
  ]);

  return items.map((item) => ({
    ...item,
    reviewed: directoryReviewed(
      reviewSkips(item.path, item.result, context),
      item.inventoryByDecision.pending,
      context.onDiskReviewed.has(item.normalizedPath),
    ),
  }));
}

export type QueueItemDetail = QueueItemWithInventoryCount & {
  job: Pick<DiscoveryJob, 'id' | 'sourceId' | 'rootPath' | 'status'>;
  /** As on the list: skips reviewed, no inventory decision pending and the on-disk contents acknowledged. */
  reviewed: boolean | null;
  skipReview: SkipReview;
  /** Who acknowledged the on-disk contents of this directory, if anyone. */
  onDiskReview: { reviewedBy: string; createdAt: Date } | null;
  /** The directory itself is an approved inventory item. */
  directoryApproved: boolean;
};

export async function getQueueItemDetail(id: string): Promise<QueueItemDetail> {
  const found = await getQueueItemWithJob(db, id);
  if (!found) throw new DiscoveryError('not_found', 'queue item not found');

  const { item, job } = found;
  const [context, approved, review] = await Promise.all([
    loadReviewContext(job.sourceId, item.path),
    listInventoryItemRows(db, {
      sourceId: job.sourceId,
      normalizedPath: item.normalizedPath,
      decision: 'approved',
      limit: 1,
    }),
    getOnDiskReview(db, job.sourceId, item.normalizedPath),
  ]);

  const onDiskReview = review
    ? { reviewedBy: review.reviewedBy, createdAt: review.createdAt }
    : null;
  const skipReview = reviewSkips(item.path, item.result, context);

  return {
    ...item,
    job: {
      id: job.id,
      sourceId: job.sourceId,
      rootPath: job.rootPath,
      status: job.status,
    },
    reviewed: directoryReviewed(
      skipReview,
      item.inventoryByDecision.pending,
      onDiskReview !== null,
    ),
    skipReview,
    onDiskReview,
    directoryApproved: approved.length > 0,
  };
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
