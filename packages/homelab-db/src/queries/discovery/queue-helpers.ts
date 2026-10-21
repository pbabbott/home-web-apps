import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryQueueItems,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
} from '../../schema/discovery';
import type { Tx } from '../shared';

// -- queue helpers ----------------------------------------------------------

export type QueuePath = {
  path: string;
  normalizedPath: string;
  /** Overrides the batch priority for this path. */
  priority?: number;
  /** Why the path is worth exploring, for whoever claims it later. */
  reason?: string;
};

export type QueueCounts = Record<DiscoveryQueueItemStatus, number>;

const emptyCounts = (): QueueCounts => ({
  queued: 0,
  in_progress: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
});

/** Item counts by status for one job's queue. */
export const getQueueCounts = async (
  db: Database | Tx,
  jobId: string,
): Promise<QueueCounts> => {
  const rows = await db
    .select({
      status: discoveryQueueItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.jobId, jobId))
    .groupBy(discoveryQueueItems.status);

  const counts = emptyCounts();
  for (const row of rows) counts[row.status] = row.count;

  return counts;
};

/**
 * Inserts paths, ignoring any already queued for the job (matched on
 * normalized path, so differently-cased spellings dedupe). Returns every
 * requested path's row — new or pre-existing — flagged with `created`.
 */
export const insertQueuePaths = async (
  db: Database | Tx,
  input: {
    jobId: string;
    paths: QueuePath[];
    priority?: number;
  },
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> => {
  const unique = [
    ...new Map(input.paths.map((p) => [p.normalizedPath, p])).values(),
  ];
  if (unique.length === 0) return [];

  const inserted = await db
    .insert(discoveryQueueItems)
    .values(
      unique.map((p) => ({
        jobId: input.jobId,
        path: p.path,
        normalizedPath: p.normalizedPath,
        priority: p.priority ?? input.priority ?? 0,
        reason: p.reason ?? null,
      })),
    )
    .onConflictDoNothing({
      target: [discoveryQueueItems.jobId, discoveryQueueItems.normalizedPath],
    })
    .returning();

  const createdIds = new Set(inserted.map((row) => row.id));

  const rows = await db
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.jobId, input.jobId),
        inArray(
          discoveryQueueItems.normalizedPath,
          unique.map((p) => p.normalizedPath),
        ),
      ),
    );
  const byPath = new Map(rows.map((row) => [row.normalizedPath, row]));

  return unique.map((p) => {
    const item = byPath.get(p.normalizedPath) as DiscoveryQueueItem;

    return { item, created: createdIds.has(item.id) };
  });
};

/**
 * Returns abandoned work to circulation: any in_progress item whose lease
 * has run out goes back to `queued`, or to `failed` once it has used all its
 * attempts. attemptCount and the claim history are kept for debugging.
 */
export const expireLeases = async (tx: Tx, jobId: string): Promise<void> => {
  const t = discoveryQueueItems;

  await tx
    .update(t)
    .set({
      status: sql`case when ${t.attemptCount} >= ${t.maxAttempts} then 'failed'::discovery_queue_item_status else 'queued'::discovery_queue_item_status end`,
      lastError: 'lease expired',
      availableAt: sql`now()`,
      claimedBy: null,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(t.jobId, jobId),
        eq(t.status, 'in_progress'),
        sql`${t.leaseExpiresAt} < now()`,
      ),
    );
};
