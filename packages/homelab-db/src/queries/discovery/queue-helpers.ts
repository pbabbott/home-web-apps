import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryQueueItems,
  type DiscoveryJobStatus,
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
  /**
   * Set when the path could not be read: it is recorded as `failed` at once
   * (no claim, no attempt spent) with this as its last error.
   */
  failure?: string;
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
        ...(p.failure
          ? { status: 'failed' as const, lastError: p.failure }
          : {}),
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
 * attempts. An abandoned claim spends its attempt. attemptCount, lastError
 * (worker and attempt) and lastClaimedBy are kept for debugging.
 */
export const expireLeases = async (tx: Tx, jobId: string): Promise<void> => {
  const t = discoveryQueueItems;

  await tx
    .update(t)
    .set({
      status: sql`case when ${t.attemptCount} >= ${t.maxAttempts} then 'failed'::discovery_queue_item_status else 'queued'::discovery_queue_item_status end`,
      lastError: sql`'lease expired' || case when ${t.attemptCount} >= ${t.maxAttempts} then ' on final attempt' else '' end || ' (worker ' || coalesce(${t.claimedBy}, 'unknown') || ', attempt ' || ${t.attemptCount} || '/' || ${t.maxAttempts} || ')'`,
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

/** Where an active job stands: what a human or agent should do about it. */
export type JobPhase =
  | 'work_remaining'
  | 'stuck_claims'
  | 'awaiting_completion';

/**
 * `stuck_claims` (an in-progress lease has expired, so a worker is gone) wins
 * over `work_remaining`; `awaiting_completion` means discovery is drained and
 * only a human completing the job is left. Null once the job is finished.
 */
export const jobPhase = (
  status: DiscoveryJobStatus,
  counts: QueueCounts,
  staleClaims: number,
): JobPhase | null => {
  if (status !== 'pending' && status !== 'running') return null;
  if (staleClaims > 0) return 'stuck_claims';
  if (counts.queued > 0 || counts.in_progress > 0) return 'work_remaining';

  return 'awaiting_completion';
};

export type QueueSummary = {
  queueCounts: QueueCounts;
  /** In-progress items whose lease has expired; the next claim reclaims them. */
  staleClaims: number;
  /** Most recent change to any item of the job: the agent's pulse. */
  lastActivityAt: Date | null;
  /** Worker that held the most recently changed claimed item. */
  lastWorker: string | null;
  phase: JobPhase | null;
};

/**
 * Counts, stale claims and last activity for several jobs in two queries, so
 * lists of jobs need no per-job round trip. Every requested id gets an entry.
 */
export const getQueueSummaries = async (
  db: Database | Tx,
  jobs: { id: string; status: DiscoveryJobStatus }[],
): Promise<Map<string, QueueSummary>> => {
  const result = new Map<string, QueueSummary>();
  for (const job of jobs) {
    result.set(job.id, {
      queueCounts: emptyCounts(),
      staleClaims: 0,
      lastActivityAt: null,
      lastWorker: null,
      phase: null,
    });
  }
  if (jobs.length === 0) return result;

  const ids = jobs.map((j) => j.id);
  const t = discoveryQueueItems;

  const rows = await db
    .select({
      jobId: t.jobId,
      status: t.status,
      count: sql<number>`count(*)::int`,
      stale: sql<number>`(count(*) filter (where ${t.status} = 'in_progress' and ${t.leaseExpiresAt} < now()))::int`,
      lastAt: sql<Date | null>`max(${t.updatedAt})`,
    })
    .from(t)
    .where(inArray(t.jobId, ids))
    .groupBy(t.jobId, t.status);

  for (const row of rows) {
    const summary = result.get(row.jobId) as QueueSummary;
    summary.queueCounts[row.status] = row.count;
    summary.staleClaims += row.stale;
    if (row.lastAt) {
      const at = new Date(row.lastAt);
      if (!summary.lastActivityAt || at > summary.lastActivityAt) {
        summary.lastActivityAt = at;
      }
    }
  }

  const workers = await db
    .selectDistinctOn([t.jobId], {
      jobId: t.jobId,
      worker: sql<string>`coalesce(${t.claimedBy}, ${t.lastClaimedBy})`,
    })
    .from(t)
    .where(and(inArray(t.jobId, ids), sql`${t.lastClaimedBy} is not null`))
    .orderBy(t.jobId, desc(t.updatedAt));

  for (const { jobId, worker } of workers) {
    (result.get(jobId) as QueueSummary).lastWorker = worker;
  }

  for (const job of jobs) {
    const summary = result.get(job.id) as QueueSummary;
    summary.phase = jobPhase(
      job.status,
      summary.queueCounts,
      summary.staleClaims,
    );
    // A lapsed lease only matters while the job can still be claimed from.
    if (summary.phase === null) summary.staleClaims = 0;
  }

  return result;
};
