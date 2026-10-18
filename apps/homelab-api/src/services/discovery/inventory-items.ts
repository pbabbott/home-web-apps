import {
  DiscoveryError,
  getQueueItemById,
  getSourceById,
  listInventoryItems as listInventoryItemRows,
  recordInventoryItems,
  type InventoryItem,
  type InventoryItemType,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { isWithinPath, normalizeWindowsPath } from '../../lib/windows-path';
import { toInventoryPath, type InventoryItemInput } from './paths';

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
