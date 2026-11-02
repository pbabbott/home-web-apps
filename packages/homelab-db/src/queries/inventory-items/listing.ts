import { and, asc, count, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  inventoryItems,
  type InventoryItemDecision,
  type InventoryItemRecommendation,
  type InventoryItemKind,
  type InventoryItem,
} from '../../schema/discovery';
import { escapeLike, type Tx } from '../shared';

export type ListInventoryItemsOptions = {
  sourceId: string;
  /** Inventory items last proposed by this job. */
  jobId?: string;
  /** Inventory items last proposed by this queue item. */
  queueItemId?: string;
  recommendation?: InventoryItemRecommendation;
  decision?: InventoryItemDecision;
  kind?: InventoryItemKind;
  /** The path (normalized) itself and everything beneath it. */
  normalizedPathPrefix?: string;
  /** Exactly this path (normalized), nothing beneath it. */
  normalizedPath?: string;
  /** Case-insensitive substring of the path, display name or summary. */
  search?: string;
  /** Keyset cursor: the last normalizedRootPath of the previous page. */
  after?: string;
  /** Rows to skip, for numbered pages. Not combined with `after`. */
  offset?: number;
  limit?: number;
};

const LIST_INVENTORY_ITEMS_DEFAULT_LIMIT = 100;
const LIST_INVENTORY_ITEMS_MAX_LIMIT = 500;

const subtreeFilter = (normalizedDir: string): SQL => {
  const t = inventoryItems;
  const dir = normalizedDir.endsWith('\\')
    ? normalizedDir.slice(0, -1)
    : normalizedDir;

  return sql`(${t.normalizedRootPath} = ${normalizedDir} or ${t.normalizedRootPath} like ${`${escapeLike(dir)}\\%`} escape '!')`;
};

const searchFilter = (search: string): SQL => {
  const t = inventoryItems;
  const pattern = `%${escapeLike(search)}%`;

  return sql`(${t.rootPath} ilike ${pattern} escape '!' or ${t.displayName} ilike ${pattern} escape '!' or ${t.summary} ilike ${pattern} escape '!')`;
};

/** The filters shared by a page of inventory items and its total. Paging is applied by the caller. */
const filterConditions = (
  options: ListInventoryItemsOptions,
  { cursor }: { cursor: boolean },
): (SQL | undefined)[] => {
  const t = inventoryItems;

  return [
    eq(t.sourceId, options.sourceId),
    options.jobId ? eq(t.lastJobId, options.jobId) : undefined,
    options.queueItemId
      ? eq(t.lastQueueItemId, options.queueItemId)
      : undefined,
    options.recommendation
      ? eq(t.recommendation, options.recommendation)
      : undefined,
    options.decision ? eq(t.decision, options.decision) : undefined,
    options.kind ? eq(t.kind, options.kind) : undefined,
    options.normalizedPathPrefix
      ? subtreeFilter(options.normalizedPathPrefix)
      : undefined,
    options.normalizedPath
      ? eq(t.normalizedRootPath, options.normalizedPath)
      : undefined,
    options.search ? searchFilter(options.search) : undefined,
    cursor && options.after
      ? gt(t.normalizedRootPath, options.after)
      : undefined,
  ];
};

export const listInventoryItems = async (
  db: Database | Tx,
  options: ListInventoryItemsOptions,
): Promise<InventoryItem[]> => {
  const t = inventoryItems;

  return db
    .select()
    .from(t)
    .where(and(...filterConditions(options, { cursor: true })))
    .orderBy(asc(t.normalizedRootPath))
    .limit(
      Math.min(
        options.limit ?? LIST_INVENTORY_ITEMS_DEFAULT_LIMIT,
        LIST_INVENTORY_ITEMS_MAX_LIMIT,
      ),
    )
    .offset(options.offset ?? 0);
};

/** Normalized root paths of every inventory item at or beneath a path, with no page limit. */
export const listInventoriedPaths = async (
  db: Database | Tx,
  sourceId: string,
  normalizedPathPrefix: string,
): Promise<string[]> => {
  const t = inventoryItems;
  const rows = await db
    .select({ path: t.normalizedRootPath })
    .from(t)
    .where(and(eq(t.sourceId, sourceId), subtreeFilter(normalizedPathPrefix)));

  return rows.map((row) => row.path);
};

/** What the directory page needs of an inventory item to say how it covers a path. */
export type InventoryCoverage = Pick<
  InventoryItem,
  'normalizedRootPath' | 'decision' | 'recommendation'
>;

/** Every inventory item at or beneath a path, with no page limit. */
export const listInventoryUnder = async (
  db: Database | Tx,
  sourceId: string,
  normalizedPathPrefix: string,
): Promise<InventoryCoverage[]> => {
  const t = inventoryItems;

  return db
    .select({
      normalizedRootPath: t.normalizedRootPath,
      decision: t.decision,
      recommendation: t.recommendation,
    })
    .from(t)
    .where(and(eq(t.sourceId, sourceId), subtreeFilter(normalizedPathPrefix)));
};

/** How many inventory items match the filters, ignoring the paging options. */
export const countInventoryItems = async (
  db: Database | Tx,
  options: ListInventoryItemsOptions,
): Promise<number> => {
  const [row] = await db
    .select({ total: count() })
    .from(inventoryItems)
    .where(and(...filterConditions(options, { cursor: false })));

  return row.total;
};

/** The part of a nearby inventory item worth showing next to a proposal. */
export type NestedInventoryItem = Pick<
  InventoryItem,
  'id' | 'kind' | 'rootPath' | 'displayName' | 'recommendation' | 'decision'
>;

const NESTED_COVERS_LIMIT = 50;

const nestedColumns = {
  id: inventoryItems.id,
  kind: inventoryItems.kind,
  rootPath: inventoryItems.rootPath,
  displayName: inventoryItems.displayName,
  recommendation: inventoryItems.recommendation,
  decision: inventoryItems.decision,
};

/**
 * Other inventory items of the source that overlap a path: `coveredBy` are those
 * whose root is a proper ancestor (`ancestorPaths` are the normalized
 * ancestors of the path), `covers` those beneath it (capped, ordered by path).
 * Informational only: nesting is allowed and nothing is inherited.
 */
export const findNestedInventoryItems = async (
  db: Database | Tx,
  sourceId: string,
  normalizedPath: string,
  ancestorPaths: string[],
): Promise<{
  coveredBy: NestedInventoryItem[];
  covers: NestedInventoryItem[];
}> => {
  const t = inventoryItems;

  const coveredBy = ancestorPaths.length
    ? await db
        .select(nestedColumns)
        .from(t)
        .where(
          and(
            eq(t.sourceId, sourceId),
            inArray(t.normalizedRootPath, ancestorPaths),
          ),
        )
        .orderBy(asc(t.normalizedRootPath))
    : [];

  const covers = await db
    .select(nestedColumns)
    .from(t)
    .where(
      and(
        eq(t.sourceId, sourceId),
        subtreeFilter(normalizedPath),
        sql`${t.normalizedRootPath} <> ${normalizedPath}`,
      ),
    )
    .orderBy(asc(t.normalizedRootPath))
    .limit(NESTED_COVERS_LIMIT);

  return { coveredBy, covers };
};
