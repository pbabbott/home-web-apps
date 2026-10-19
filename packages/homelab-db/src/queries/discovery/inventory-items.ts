import { and, asc, eq, gt, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type InventoryItem,
  type InventoryItemType,
  type ReviewDisposition,
} from '../../schema/discovery';
import { activeClaim, claimMissError } from './claims';
import { upsertInventoryItems, type InventoryPath } from './inventory-upsert';

// -- inventory items --------------------------------------------------------

export type RecordInventoryItemsInput = {
  claimToken: string;
  items: InventoryPath[];
};

/**
 * Records what was found inside a claimed directory. Identity is source +
 * normalized path, so rediscovery (a retry, a reclaimed lease, a later job)
 * updates the existing row instead of adding one (see upsertInventoryItems).
 * The source and job come from the claimed item, never from the caller, and
 * the claim must be live on an active job.
 */
export const recordInventoryItems = async (
  db: Database,
  queueItemId: string,
  input: RecordInventoryItemsInput,
): Promise<{ item: InventoryItem; created: boolean }[]> =>
  db.transaction(async (tx) => {
    const [claimed] = await tx
      .select({
        jobId: discoveryQueueItems.jobId,
        sourceId: discoveryJobs.sourceId,
      })
      .from(discoveryQueueItems)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
      .where(activeClaim(queueItemId, input.claimToken));

    if (!claimed) throw await claimMissError(tx, queueItemId);

    return upsertInventoryItems(tx, { ...claimed, items: input.items });
  });

export type ListInventoryItemsOptions = {
  sourceId: string;
  /** Items last seen by this job. */
  jobId?: string;
  itemType?: InventoryItemType;
  reviewDisposition?: ReviewDisposition;
  /** Direct children of this directory (normalized). */
  normalizedParentPath?: string;
  /**
   * The directory (normalized) itself and everything beneath it. Matches on
   * directory boundaries: `c:\\foo` does not match `c:\\foobar`.
   */
  normalizedPathPrefix?: string;
  /** Keyset cursor: the last normalizedPath of the previous page. */
  after?: string;
  limit?: number;
};

const LIST_INVENTORY_DEFAULT_LIMIT = 500;
const LIST_INVENTORY_MAX_LIMIT = 1000;

/** Escapes LIKE wildcards so a prefix is matched literally. */
const escapeLike = (value: string): string => value.replace(/[!%_]/g, '!$&');

/** The directory itself plus anything under `dir\\`, never a sibling sharing its name as a prefix. */
const subtreeFilter = (normalizedDir: string): SQL => {
  const t = inventoryItems;
  const dir = normalizedDir.endsWith('\\')
    ? normalizedDir.slice(0, -1)
    : normalizedDir;

  return sql`(${t.normalizedPath} = ${normalizedDir} or ${t.normalizedPath} like ${`${escapeLike(dir)}\\%`} escape '!')`;
};

export const listInventoryItems = async (
  db: Database,
  options: ListInventoryItemsOptions,
): Promise<InventoryItem[]> => {
  const t = inventoryItems;
  const filters: (SQL | undefined)[] = [
    eq(t.sourceId, options.sourceId),
    options.jobId ? eq(t.lastJobId, options.jobId) : undefined,
    options.itemType ? eq(t.itemType, options.itemType) : undefined,
    options.reviewDisposition
      ? eq(t.reviewDisposition, options.reviewDisposition)
      : undefined,
    options.normalizedParentPath
      ? eq(t.normalizedParentPath, options.normalizedParentPath)
      : undefined,
    options.normalizedPathPrefix
      ? subtreeFilter(options.normalizedPathPrefix)
      : undefined,
    options.after ? gt(t.normalizedPath, options.after) : undefined,
  ];

  return db
    .select()
    .from(t)
    .where(and(...filters))
    .orderBy(asc(t.normalizedPath))
    .limit(
      Math.min(
        options.limit ?? LIST_INVENTORY_DEFAULT_LIMIT,
        LIST_INVENTORY_MAX_LIMIT,
      ),
    );
};
