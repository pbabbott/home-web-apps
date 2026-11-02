import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
} from '../../schema/discovery';

// -- queue items ------------------------------------------------------------

export const getQueueItemById = async (
  db: Database,
  id: string,
): Promise<DiscoveryQueueItem | undefined> => {
  const [row] = await db
    .select()
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.id, id));

  return row;
};

export type ListQueueItemsOptions = {
  /** Items of any job of this source. */
  sourceId?: string;
  jobId?: string;
  status?: DiscoveryQueueItemStatus;
};

const LIST_QUEUE_ITEMS_LIMIT = 500;

/** Inventory items a queue item last proposed or added, by human decision. */
export type InventoryDecisionCounts = {
  pending: number;
  approved: number;
  rejected: number;
};

/** A queue item plus how many inventory items it last proposed or added. */
export type QueueItemWithInventoryCount = DiscoveryQueueItem & {
  /** All of `inventoryByDecision` added up. */
  inventoryCount: number;
  inventoryByDecision: InventoryDecisionCounts;
};

const inventoryDecisionCountsSql = sql<InventoryDecisionCounts>`(
  select jsonb_build_object(
    'pending', count(*) filter (where ${inventoryItems.decision} = 'pending'),
    'approved', count(*) filter (where ${inventoryItems.decision} = 'approved'),
    'rejected', count(*) filter (where ${inventoryItems.decision} = 'rejected')
  ) from ${inventoryItems}
  where ${inventoryItems.lastQueueItemId} = ${discoveryQueueItems.id}
)`;

const withInventoryCounts = (
  item: DiscoveryQueueItem,
  inventoryByDecision: InventoryDecisionCounts,
): QueueItemWithInventoryCount => ({
  ...item,
  inventoryCount:
    inventoryByDecision.pending +
    inventoryByDecision.approved +
    inventoryByDecision.rejected,
  inventoryByDecision,
});

/**
 * Most recently changed first, so when a big job exceeds the limit it is the
 * oldest, settled items that drop off rather than fresh failures.
 */
export const listQueueItems = async (
  db: Database,
  options: ListQueueItemsOptions,
): Promise<QueueItemWithInventoryCount[]> => {
  const rows = await db
    .select({
      item: discoveryQueueItems,
      inventoryByDecision: inventoryDecisionCountsSql,
    })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(
      and(
        options.sourceId
          ? eq(discoveryJobs.sourceId, options.sourceId)
          : undefined,
        options.jobId
          ? eq(discoveryQueueItems.jobId, options.jobId)
          : undefined,
        options.status
          ? eq(discoveryQueueItems.status, options.status)
          : undefined,
      ),
    )
    .orderBy(desc(discoveryQueueItems.updatedAt), asc(discoveryQueueItems.path))
    .limit(LIST_QUEUE_ITEMS_LIMIT);

  return rows.map((row) =>
    withInventoryCounts(row.item, row.inventoryByDecision),
  );
};

/** One queue item with the inventory count and the job it belongs to, or undefined. */
export const getQueueItemWithJob = async (
  db: Database,
  id: string,
): Promise<
  | {
      item: QueueItemWithInventoryCount;
      job: typeof discoveryJobs.$inferSelect;
    }
  | undefined
> => {
  const [row] = await db
    .select({
      item: discoveryQueueItems,
      job: discoveryJobs,
      inventoryByDecision: inventoryDecisionCountsSql,
    })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(eq(discoveryQueueItems.id, id));

  if (!row) return undefined;

  return {
    item: withInventoryCounts(row.item, row.inventoryByDecision),
    job: row.job,
  };
};

/** Status of the job's queue items at exactly these (normalized) paths, keyed by path. */
export const listJobQueueStatusesAt = async (
  db: Database,
  jobId: string,
  normalizedPaths: string[],
): Promise<Map<string, DiscoveryQueueItemStatus>> => {
  if (normalizedPaths.length === 0) return new Map();

  const rows = await db
    .select({
      path: discoveryQueueItems.normalizedPath,
      status: discoveryQueueItems.status,
    })
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.jobId, jobId),
        inArray(discoveryQueueItems.normalizedPath, normalizedPaths),
      ),
    );

  return new Map(rows.map((row) => [row.path, row.status]));
};

/** The queue item of any job of the source that a path-coverage check can point at. */
export type VisitedQueueItem = Pick<
  DiscoveryQueueItem,
  'id' | 'jobId' | 'path' | 'status'
>;

/**
 * The deepest queue item of the source at one of these (normalized) paths, in
 * any job; the newest wins a tie. Pass a path and its ancestors to find the
 * nearest directory a job has visited.
 */
export const findDeepestQueueItemAt = async (
  db: Database,
  sourceId: string,
  normalizedPaths: string[],
): Promise<VisitedQueueItem | undefined> => {
  if (normalizedPaths.length === 0) return undefined;

  const [row] = await db
    .select({
      id: discoveryQueueItems.id,
      jobId: discoveryQueueItems.jobId,
      path: discoveryQueueItems.path,
      status: discoveryQueueItems.status,
    })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(
      and(
        eq(discoveryJobs.sourceId, sourceId),
        inArray(discoveryQueueItems.normalizedPath, normalizedPaths),
      ),
    )
    .orderBy(
      desc(sql`length(${discoveryQueueItems.normalizedPath})`),
      desc(discoveryQueueItems.createdAt),
    )
    .limit(1);

  return row;
};
