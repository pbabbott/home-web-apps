import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../client';
import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';
import {
  sources,
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type Source,
  type DiscoveryJob,
  type DiscoveryJobStatus,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type InventoryItem,
  type InventoryItemType,
  type NewSource,
} from '../schema/discovery';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * A rule violation the caller can act on: the row is missing (`not_found`)
 * or the request conflicts with current state (`conflict`) — a duplicate
 * name, an illegal status transition, a lost lease. `details` carries
 * structured context (e.g. queue counts blocking job completion).
 */
export class DiscoveryError extends Error {
  constructor(
    readonly code: 'not_found' | 'conflict',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

// -- sources ---------------------------------------------------------

export type CreateSourceInput = Pick<
  NewSource,
  'name' | 'hostId' | 'sourceType'
>;

export const createSource = async (
  db: Database,
  input: CreateSourceInput,
): Promise<Source> => {
  try {
    const [row] = await db.insert(sources).values(input).returning();

    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DiscoveryError(
        'conflict',
        `source named "${input.name}" already exists`,
      );
    }
    if (isForeignKeyViolation(err)) {
      throw new DiscoveryError('not_found', 'host not found');
    }
    throw err;
  }
};

export const listSources = async (db: Database): Promise<Source[]> =>
  db.select().from(sources).orderBy(sources.name);

export const getSourceById = async (
  db: Database,
  id: string,
): Promise<Source | undefined> => {
  const [row] = await db.select().from(sources).where(eq(sources.id, id));

  return row;
};

// -- queue helpers ----------------------------------------------------------

export type QueuePath = { path: string; normalizedPath: string };

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
const insertQueuePaths = async (
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
        priority: input.priority ?? 0,
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
const expireLeases = async (tx: Tx, jobId: string): Promise<void> => {
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

// -- discovery jobs ---------------------------------------------------------

export type CreateDiscoveryJobInput = {
  sourceId: string;
  root: QueuePath;
  /**
   * The root as an inventory directory. Nothing else would ever record it
   * (a worker only records what lies beneath the directory it holds), so
   * without this the root could not be reviewed or marked later.
   */
  rootInventory: InventoryPath;
};

/**
 * Creates a pending job, seeds its queue with the root directory and records
 * the root in the inventory, all in one transaction. Fails with `conflict` if
 * the source already has an active job.
 */
export const createDiscoveryJob = async (
  db: Database,
  input: CreateDiscoveryJobInput,
): Promise<DiscoveryJob> => {
  try {
    return await db.transaction(async (tx) => {
      const [source] = await tx
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.id, input.sourceId));

      if (!source) {
        throw new DiscoveryError('not_found', 'source not found');
      }

      const [job] = await tx
        .insert(discoveryJobs)
        .values({
          sourceId: input.sourceId,
          rootPath: input.root.path,
          normalizedRootPath: input.root.normalizedPath,
        })
        .returning();

      await insertQueuePaths(tx, { jobId: job.id, paths: [input.root] });
      await upsertInventoryItems(tx, {
        sourceId: input.sourceId,
        jobId: job.id,
        items: [input.rootInventory],
      });

      return job;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DiscoveryError(
        'conflict',
        'this source already has an active discovery job',
      );
    }
    throw err;
  }
};

export const getDiscoveryJobById = async (
  db: Database | Tx,
  id: string,
): Promise<DiscoveryJob | undefined> => {
  const [row] = await db
    .select()
    .from(discoveryJobs)
    .where(eq(discoveryJobs.id, id));

  return row;
};

const LIST_DISCOVERY_JOBS_LIMIT = 50;

/** A source's most recent jobs, newest first. */
export const listDiscoveryJobs = async (
  db: Database,
  sourceId: string,
): Promise<DiscoveryJob[]> =>
  db
    .select()
    .from(discoveryJobs)
    .where(eq(discoveryJobs.sourceId, sourceId))
    .orderBy(desc(discoveryJobs.createdAt))
    .limit(LIST_DISCOVERY_JOBS_LIMIT);

export type ListAllDiscoveryJobsOptions = {
  /** Only this source's jobs. */
  sourceId?: string;
};

export type DiscoveryJobWithSource = DiscoveryJob & {
  sourceName: string;
  hostId: string | null;
};

const LIST_ALL_DISCOVERY_JOBS_LIMIT = 100;

/** Jobs across every source, newest first, each with its source's name and host. */
export const listAllDiscoveryJobs = async (
  db: Database,
  options: ListAllDiscoveryJobsOptions = {},
): Promise<DiscoveryJobWithSource[]> => {
  const rows = await db
    .select({
      job: discoveryJobs,
      sourceName: sources.name,
      hostId: sources.hostId,
    })
    .from(discoveryJobs)
    .innerJoin(sources, eq(sources.id, discoveryJobs.sourceId))
    .where(
      options.sourceId
        ? eq(discoveryJobs.sourceId, options.sourceId)
        : undefined,
    )
    .orderBy(desc(discoveryJobs.createdAt))
    .limit(LIST_ALL_DISCOVERY_JOBS_LIMIT);

  return rows.map(({ job, sourceName, hostId }) => ({
    ...job,
    sourceName,
    hostId,
  }));
};

const ACTIVE_JOB_STATUSES: DiscoveryJobStatus[] = ['pending', 'running'];

/**
 * Moves a job to a terminal status. `pending`/`running` are the only legal
 * starting points — `completed`, `failed` and `cancelled` are final. Leases
 * are released in the same transaction: an in-progress item goes back to
 * `queued` with no claim, so a late worker is rejected (its token is gone)
 * and the item stays on record as work that was never finished. Queued and
 * failed items are left as they are.
 */
export const transitionDiscoveryJob = async (
  db: Database,
  id: string,
  to: Extract<DiscoveryJobStatus, 'failed' | 'cancelled'>,
  error?: string,
): Promise<DiscoveryJob> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(discoveryJobs)
      .set({
        status: to,
        error: error ?? null,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(discoveryJobs.id, id),
          inArray(discoveryJobs.status, ACTIVE_JOB_STATUSES),
        ),
      )
      .returning();

    if (!row) {
      const existing = await getDiscoveryJobById(tx, id);
      if (!existing)
        throw new DiscoveryError('not_found', 'discovery job not found');

      throw new DiscoveryError(
        'conflict',
        `job is already ${existing.status}; cannot move to ${to}`,
      );
    }

    const t = discoveryQueueItems;
    await tx
      .update(t)
      .set({
        status: 'queued',
        lastError: `job ${to}`,
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(t.jobId, id), eq(t.status, 'in_progress')));

    return row;
  });

/**
 * Completes a job once nothing is queued or in progress (after reclaiming
 * expired leases). Permanently failed items do not block completion — the
 * job finishes "with failures", which callers read off the queue counts.
 * A queued item waiting out its retry backoff does count as outstanding.
 */
export const completeDiscoveryJob = async (
  db: Database,
  id: string,
): Promise<DiscoveryJob> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, id))
      .for('no key update');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError(
        'conflict',
        `job is already ${job.status}; cannot complete`,
      );
    }

    await expireLeases(tx, job.id);
    const counts = await getQueueCounts(tx, job.id);

    if (counts.queued > 0 || counts.in_progress > 0) {
      throw new DiscoveryError(
        'conflict',
        'job still has queued or in-progress work',
        { queueCounts: counts },
      );
    }

    const [done] = await tx
      .update(discoveryJobs)
      .set({
        status: 'completed',
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(discoveryJobs.id, id))
      .returning();

    return done;
  });

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

export const listQueueItems = async (
  db: Database,
  options: ListQueueItemsOptions,
): Promise<DiscoveryQueueItem[]> => {
  const rows = await db
    .select({ item: discoveryQueueItems })
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
    .orderBy(asc(discoveryQueueItems.createdAt), asc(discoveryQueueItems.path))
    .limit(LIST_QUEUE_ITEMS_LIMIT);

  return rows.map((row) => row.item);
};

export type EnqueueQueueItemsInput = {
  jobId: string;
  paths: QueuePath[];
  priority?: number;
};

/**
 * Enqueues directories for an active job; already-queued paths are skipped.
 * The job row is share-locked so this cannot interleave with completing,
 * cancelling or failing the job: either it runs first and the job then sees
 * the new work, or it waits and is rejected because the job is finished.
 */
export const enqueueQueueItems = async (
  db: Database,
  input: EnqueueQueueItemsInput,
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, input.jobId))
      .for('share');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError('conflict', `job is ${job.status}`);
    }

    return insertQueuePaths(tx, {
      jobId: job.id,
      paths: input.paths,
      priority: input.priority,
    });
  });

export type ClaimQueueItemInput = {
  jobId: string;
  workerId: string;
  leaseSeconds: number;
};

/** Why a claim found nothing, so a worker knows whether to wait or stop. */
export type ClaimIdleReason = 'queue_empty' | 'retry_backoff' | 'in_progress';

export type ClaimQueueItemResult =
  | { item: DiscoveryQueueItem }
  | {
      item: null;
      /**
       * `queue_empty`: nothing queued or in progress — the job can be completed.
       * `retry_backoff`: queued items are waiting out a retry delay.
       * `in_progress`: only other workers' leases remain.
       */
      reason: ClaimIdleReason;
      /** When it is worth asking again; null for `queue_empty`. */
      retryAt: Date | null;
      queueCounts: QueueCounts;
    };

/**
 * Atomically claims the highest-priority eligible directory of an active
 * job's queue. Expired leases are reclaimed first, so abandoned work is
 * picked up by the next caller. The job row is locked for the whole claim,
 * which serializes claimers per job and keeps a concurrent cancel or fail
 * from interleaving (it would otherwise miss the item being claimed);
 * `FOR UPDATE SKIP LOCKED` on the item is the second guard that no row is
 * ever handed out twice. The first claim also moves the job from pending to
 * running. When nothing can be claimed the result says why.
 */
export const claimNextQueueItem = async (
  db: Database,
  input: ClaimQueueItemInput,
): Promise<ClaimQueueItemResult> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, input.jobId))
      .for('no key update');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError('conflict', `job is ${job.status}`);
    }

    await expireLeases(tx, job.id);

    const t = discoveryQueueItems;
    const [next] = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          eq(t.jobId, job.id),
          eq(t.status, 'queued'),
          lte(t.availableAt, sql`now()`),
        ),
      )
      .orderBy(desc(t.priority), asc(t.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) return describeIdleQueue(tx, job.id);

    const [item] = await tx
      .update(t)
      .set({
        status: 'in_progress',
        attemptCount: sql`${t.attemptCount} + 1`,
        claimedBy: input.workerId,
        claimToken: sql`gen_random_uuid()`,
        leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
        updatedAt: sql`now()`,
      })
      .where(eq(t.id, next.id))
      .returning();

    if (job.status === 'pending') {
      await tx
        .update(discoveryJobs)
        .set({
          status: 'running',
          startedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(discoveryJobs.id, job.id));
    }

    return { item };
  });

const describeIdleQueue = async (
  tx: Tx,
  jobId: string,
): Promise<Extract<ClaimQueueItemResult, { item: null }>> => {
  const queueCounts = await getQueueCounts(tx, jobId);
  const t = discoveryQueueItems;

  if (queueCounts.queued > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.availableAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'queued')));

    return {
      item: null,
      reason: 'retry_backoff',
      retryAt: row.at ? new Date(row.at) : null,
      queueCounts,
    };
  }

  if (queueCounts.in_progress > 0) {
    const [row] = await tx
      .select({ at: sql<Date>`min(${t.leaseExpiresAt})` })
      .from(t)
      .where(and(eq(t.jobId, jobId), eq(t.status, 'in_progress')));

    return {
      item: null,
      reason: 'in_progress',
      retryAt: row.at ? new Date(row.at) : null,
      queueCounts,
    };
  }

  return { item: null, reason: 'queue_empty', retryAt: null, queueCounts };
};

const jobIsActive = (jobIdColumn: typeof discoveryQueueItems.jobId) =>
  sql`exists (select 1 from ${discoveryJobs} where ${discoveryJobs.id} = ${jobIdColumn} and ${discoveryJobs.status} in ('pending', 'running'))`;

/**
 * Matches only the live, current claim on an item whose job is still active:
 * a wrong token, an expired lease or a finished job all miss, so a worker
 * cannot keep writing to a job that was cancelled or failed under it.
 */
const activeClaim = (id: string, claimToken: string) =>
  and(
    eq(discoveryQueueItems.id, id),
    eq(discoveryQueueItems.status, 'in_progress'),
    eq(discoveryQueueItems.claimToken, claimToken),
    gt(discoveryQueueItems.leaseExpiresAt, sql`now()`),
    jobIsActive(discoveryQueueItems.jobId),
  );

/** A guarded write matched nothing: either no such item or the claim is dead. */
const claimMissError = async (
  db: Database | Tx,
  id: string,
): Promise<DiscoveryError> => {
  const [row] = await db
    .select({ jobStatus: discoveryJobs.status })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(eq(discoveryQueueItems.id, id));

  if (!row) return new DiscoveryError('not_found', 'queue item not found');

  if (!ACTIVE_JOB_STATUSES.includes(row.jobStatus)) {
    return new DiscoveryError(
      'conflict',
      `job is ${row.jobStatus}; its items can no longer be changed`,
    );
  }

  return new DiscoveryError(
    'conflict',
    'claim is no longer valid (wrong token, lease expired, or item not in progress)',
  );
};

export const heartbeatQueueItem = async (
  db: Database,
  id: string,
  input: { claimToken: string; leaseSeconds: number },
): Promise<DiscoveryQueueItem> => {
  const [row] = await db
    .update(discoveryQueueItems)
    .set({
      leaseExpiresAt: sql`now() + make_interval(secs => ${input.leaseSeconds})`,
      updatedAt: sql`now()`,
    })
    .where(activeClaim(id, input.claimToken))
    .returning();

  if (!row) throw await claimMissError(db, id);

  return row;
};

export type CompleteQueueItemInput = {
  claimToken: string;
  /** Child directories found while inspecting this one. */
  discoveredPaths?: QueuePath[];
};

/**
 * Marks the claimed item completed and enqueues its discovered children in
 * the same transaction, so a crash can't complete a directory while losing
 * the subdirectories it found.
 */
export const completeQueueItem = async (
  db: Database,
  id: string,
  input: CompleteQueueItemInput,
): Promise<{
  item: DiscoveryQueueItem;
  children: { item: DiscoveryQueueItem; created: boolean }[];
}> =>
  db.transaction(async (tx) => {
    // Share-lock the job first so a concurrent cancel/fail cannot slip
    // between the completion and the enqueue of its children.
    const [owner] = await tx
      .select({ jobId: discoveryQueueItems.jobId })
      .from(discoveryQueueItems)
      .where(eq(discoveryQueueItems.id, id));

    if (owner) {
      await tx
        .select({ id: discoveryJobs.id })
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, owner.jobId))
        .for('share');
    }

    const [item] = await tx
      .update(discoveryQueueItems)
      .set({
        status: 'completed',
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(activeClaim(id, input.claimToken))
      .returning();

    if (!item) throw await claimMissError(tx, id);

    const children = await insertQueuePaths(tx, {
      jobId: item.jobId,
      paths: input.discoveredPaths ?? [],
    });

    return { item, children };
  });

export type FailQueueItemInput = {
  claimToken: string;
  error: string;
  retryable: boolean;
};

const RETRY_BASE_SECONDS = 30;
const RETRY_MAX_SECONDS = 3600;

/** Exponential backoff after the nth attempt: 30s, 60s, 120s, … capped at 1h. */
export const retryDelaySeconds = (attemptCount: number): number =>
  Math.min(
    RETRY_BASE_SECONDS * 2 ** Math.max(attemptCount - 1, 0),
    RETRY_MAX_SECONDS,
  );

/**
 * Records a failure. A retryable item with attempts left returns to `queued`
 * behind a backoff delay; otherwise it becomes `failed` (permanent until a
 * human retries it). The error is kept either way.
 */
export const failQueueItem = async (
  db: Database,
  id: string,
  input: FailQueueItemInput,
): Promise<DiscoveryQueueItem> =>
  db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(discoveryQueueItems)
      .where(activeClaim(id, input.claimToken))
      .for('update');

    if (!current) throw await claimMissError(tx, id);

    const willRetry =
      input.retryable && current.attemptCount < current.maxAttempts;

    const [row] = await tx
      .update(discoveryQueueItems)
      .set({
        status: willRetry ? 'queued' : 'failed',
        lastError: input.error,
        availableAt: willRetry
          ? sql`now() + make_interval(secs => ${retryDelaySeconds(current.attemptCount)})`
          : current.availableAt,
        claimedBy: null,
        claimToken: null,
        leaseExpiresAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(discoveryQueueItems.id, id))
      .returning();

    return row;
  });

export const skipQueueItem = async (
  db: Database,
  id: string,
  input: { claimToken: string; reason: string },
): Promise<DiscoveryQueueItem> => {
  const [row] = await db
    .update(discoveryQueueItems)
    .set({
      status: 'skipped',
      lastError: `skipped: ${input.reason}`,
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(activeClaim(id, input.claimToken))
    .returning();

  if (!row) throw await claimMissError(db, id);

  return row;
};

/**
 * Human-requested retry of a `failed` item. Grants exactly one more attempt
 * (maxAttempts = attemptCount + 1) while keeping attemptCount and lastError,
 * so the history stays visible and a still-broken directory can't loop.
 */
export const retryQueueItem = async (
  db: Database,
  id: string,
): Promise<DiscoveryQueueItem> => {
  const t = discoveryQueueItems;

  const [row] = await db
    .update(t)
    .set({
      status: 'queued',
      maxAttempts: sql`${t.attemptCount} + 1`,
      availableAt: sql`now()`,
      claimedBy: null,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(t.id, id), eq(t.status, 'failed'), jobIsActive(t.jobId)))
    .returning();

  if (row) return row;

  const [existing] = await db
    .select({ status: t.status, jobStatus: discoveryJobs.status })
    .from(t)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, t.jobId))
    .where(eq(t.id, id));

  if (!existing) throw new DiscoveryError('not_found', 'queue item not found');

  if (existing.status !== 'failed') {
    throw new DiscoveryError(
      'conflict',
      `only failed items can be retried (item is ${existing.status})`,
    );
  }

  throw new DiscoveryError(
    'conflict',
    `job is ${existing.jobStatus}; start a new discovery job to explore this directory again`,
  );
};

// -- inventory items --------------------------------------------------------

export type InventoryPath = {
  itemType: InventoryItemType;
  path: string;
  normalizedPath: string;
  parentPath: string | null;
  normalizedParentPath: string | null;
  name: string;
  extension: string | null;
  sizeBytes?: number | null;
  modifiedAt?: Date | null;
};

export type RecordInventoryItemsInput = {
  claimToken: string;
  items: InventoryPath[];
};

/**
 * Upserts inventory rows by source + normalized path. Only filesystem facts
 * and `lastSeen*` are overwritten; id, first-seen data and any future
 * review/copy columns are untouched. A missing size or mtime keeps the
 * stored value. Rows are written in normalized-path order so overlapping
 * batches from concurrent workers always lock rows in the same order and
 * cannot deadlock. Results come back in the order the paths were given.
 */
const upsertInventoryItems = async (
  tx: Tx,
  input: { sourceId: string; jobId: string; items: InventoryPath[] },
): Promise<{ item: InventoryItem; created: boolean }[]> => {
  // One statement cannot update the same row twice; last occurrence wins.
  const byPath = new Map(input.items.map((i) => [i.normalizedPath, i]));
  if (byPath.size === 0) return [];

  const inputOrder = new Map([...byPath.keys()].map((p, idx) => [p, idx]));
  const lockOrder = [...byPath.values()].sort((a, b) =>
    a.normalizedPath < b.normalizedPath
      ? -1
      : a.normalizedPath > b.normalizedPath
        ? 1
        : 0,
  );

  const t = inventoryItems;
  const rows = await tx
    .insert(t)
    .values(
      lockOrder.map((i) => ({
        sourceId: input.sourceId,
        firstJobId: input.jobId,
        lastJobId: input.jobId,
        itemType: i.itemType,
        path: i.path,
        normalizedPath: i.normalizedPath,
        parentPath: i.parentPath,
        normalizedParentPath: i.normalizedParentPath,
        name: i.name,
        extension: i.extension,
        sizeBytes: i.sizeBytes ?? null,
        modifiedAt: i.modifiedAt ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [t.sourceId, t.normalizedPath],
      set: {
        lastJobId: input.jobId,
        itemType: sql`excluded.item_type`,
        path: sql`excluded.path`,
        parentPath: sql`excluded.parent_path`,
        normalizedParentPath: sql`excluded.normalized_parent_path`,
        name: sql`excluded.name`,
        extension: sql`excluded.extension`,
        sizeBytes: sql`coalesce(excluded.size_bytes, ${t.sizeBytes})`,
        modifiedAt: sql`coalesce(excluded.modified_at, ${t.modifiedAt})`,
        lastSeenAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ ...getTableColumns(t), created: sql<boolean>`(xmax = 0)` });

  return rows
    .sort(
      (a, b) =>
        (inputOrder.get(a.normalizedPath) ?? 0) -
        (inputOrder.get(b.normalizedPath) ?? 0),
    )
    .map(({ created, ...item }) => ({ item, created }));
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
  /** Direct children of this directory (normalized). */
  normalizedParentPath?: string;
  /** Items whose normalized path starts with this (normalized) prefix. */
  normalizedPathPrefix?: string;
  /** Keyset cursor: the last normalizedPath of the previous page. */
  after?: string;
  limit?: number;
};

const LIST_INVENTORY_DEFAULT_LIMIT = 500;
const LIST_INVENTORY_MAX_LIMIT = 1000;

/** Escapes LIKE wildcards so a prefix is matched literally. */
const escapeLike = (value: string): string => value.replace(/[!%_]/g, '!$&');

export const listInventoryItems = async (
  db: Database,
  options: ListInventoryItemsOptions,
): Promise<InventoryItem[]> => {
  const t = inventoryItems;
  const filters: (SQL | undefined)[] = [
    eq(t.sourceId, options.sourceId),
    options.jobId ? eq(t.lastJobId, options.jobId) : undefined,
    options.itemType ? eq(t.itemType, options.itemType) : undefined,
    options.normalizedParentPath
      ? eq(t.normalizedParentPath, options.normalizedParentPath)
      : undefined,
    options.normalizedPathPrefix
      ? sql`${t.normalizedPath} like ${`${escapeLike(options.normalizedPathPrefix)}%`} escape '!'`
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
