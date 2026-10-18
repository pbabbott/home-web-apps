import {
  DiscoveryError,
  claimNextQueueItem,
  completeDiscoveryJob,
  completeQueueItem,
  createSource as createSourceRow,
  createDiscoveryJob as createDiscoveryJobRow,
  enqueueQueueItems,
  failQueueItem,
  getSourceById,
  getDiscoveryJobById,
  getQueueCounts,
  getQueueItemById,
  heartbeatQueueItem,
  listInventoryItems as listInventoryItemRows,
  listSources as listSourceRows,
  listAllDiscoveryJobs as listAllDiscoveryJobRows,
  listDiscoveryJobs as listDiscoveryJobRows,
  listQueueItems as listQueueItemRows,
  recordInventoryItems,
  retryQueueItem,
  skipQueueItem,
  transitionDiscoveryJob,
  type Source,
  type ClaimQueueItemResult,
  type CreateSourceInput,
  type DiscoveryJob,
  type DiscoveryJobWithSource,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type InventoryItem,
  type InventoryItemType,
  type InventoryPath,
  type QueueCounts,
  type QueuePath,
} from '@abbottland/homelab-db';
import { db } from '../db';
import {
  isWithinPath,
  normalizeWindowsPath,
  windowsPathName,
  windowsPathParent,
} from '../lib/windows-path';

export { DiscoveryError };

export type DiscoveryJobWithCounts = DiscoveryJob & {
  /** This job's item counts by status; `failed` > 0 means "finished with failures". */
  queueCounts: QueueCounts;
};

export type QueueItemWithCreated = {
  item: DiscoveryQueueItem;
  created: boolean;
};

const toQueuePath = (path: string): QueuePath => normalizeWindowsPath(path);

export type InventoryItemInput = {
  path: string;
  itemType: InventoryItemType;
  sizeBytes?: number;
  modifiedAt?: string;
};

/** Lowercased extension of a file name (`Report.PDF` -> `pdf`); none for dotfiles. */
const fileExtension = (name: string): string | null => {
  const dot = name.lastIndexOf('.');

  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toLowerCase()
    : null;
};

/** Normalizes a reported path and derives parent, name and extension from it. */
const toInventoryPath = (input: InventoryItemInput): InventoryPath => {
  const { path, normalizedPath } = normalizeWindowsPath(input.path);
  const parent = windowsPathParent(path);
  const name = windowsPathName(path);

  return {
    itemType: input.itemType,
    path,
    normalizedPath,
    parentPath: parent,
    normalizedParentPath: parent ? parent.toLowerCase() : null,
    name,
    extension: input.itemType === 'file' ? fileExtension(name) : null,
    sizeBytes: input.sizeBytes ?? null,
    modifiedAt: input.modifiedAt ? new Date(input.modifiedAt) : null,
  };
};

const withCounts = async (
  job: DiscoveryJob,
): Promise<DiscoveryJobWithCounts> => ({
  ...job,
  queueCounts: await getQueueCounts(db, job.id),
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

export const createSource = (input: CreateSourceInput): Promise<Source> =>
  createSourceRow(db, input);

export const listSources = (): Promise<Source[]> => listSourceRows(db);

export async function createDiscoveryJob(
  sourceId: string,
  rootPath: string,
): Promise<DiscoveryJobWithCounts> {
  const root = toQueuePath(rootPath);
  const job = await createDiscoveryJobRow(db, {
    sourceId,
    root,
    rootInventory: toInventoryPath({ path: rootPath, itemType: 'directory' }),
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
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
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

export type InventoryItemWithCreated = {
  item: InventoryItem;
  created: boolean;
};

/**
 * Records what a worker found inside the directory it has claimed. Items
 * must lie strictly beneath that directory — a worker can only report on
 * the directory it holds.
 */
export async function recordInventory(
  queueItemId: string,
  claimToken: string,
  items: InventoryItemInput[],
): Promise<InventoryItemWithCreated[]> {
  const claimed = await getQueueItemById(db, queueItemId);
  if (!claimed) throw new DiscoveryError('not_found', 'queue item not found');

  const normalized = items.map(toInventoryPath);

  const outside = normalized.filter(
    (i) =>
      i.normalizedPath === claimed.normalizedPath ||
      !isWithinPath(claimed.normalizedPath, i.normalizedPath),
  );

  if (outside.length > 0) {
    throw new DiscoveryError(
      'conflict',
      `paths are not inside the claimed directory ${claimed.path}`,
      { paths: outside.map((i) => i.path) },
    );
  }

  return recordInventoryItems(db, queueItemId, {
    claimToken,
    items: normalized,
  });
}

export async function listSourceInventory(
  sourceId: string,
  filters: {
    jobId?: string;
    itemType?: InventoryItemType;
    parentPath?: string;
    pathPrefix?: string;
    after?: string;
    limit?: number;
  },
): Promise<InventoryItem[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listInventoryItemRows(db, {
    sourceId,
    jobId: filters.jobId,
    itemType: filters.itemType,
    normalizedParentPath: filters.parentPath
      ? normalizeWindowsPath(filters.parentPath).normalizedPath
      : undefined,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    after: filters.after,
    limit: filters.limit,
  });
}
