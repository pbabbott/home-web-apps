import { and, asc, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';
import {
  backupSources,
  discoveryJobs,
  discoveryQueueItems,
  type BackupSource,
  type DiscoveryJob,
  type DiscoveryJobStatus,
  type DiscoveryQueueItem,
  type DiscoveryQueueItemStatus,
  type NewBackupSource,
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

// -- backup sources ---------------------------------------------------------

export type CreateBackupSourceInput = Pick<
  NewBackupSource,
  'name' | 'hostId' | 'sourceType'
>;

export const createBackupSource = async (
  db: Database,
  input: CreateBackupSourceInput,
): Promise<BackupSource> => {
  try {
    const [row] = await db.insert(backupSources).values(input).returning();

    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DiscoveryError(
        'conflict',
        `backup source named "${input.name}" already exists`,
      );
    }
    if (isForeignKeyViolation(err)) {
      throw new DiscoveryError('not_found', 'host not found');
    }
    throw err;
  }
};

export const listBackupSources = async (
  db: Database,
): Promise<BackupSource[]> =>
  db.select().from(backupSources).orderBy(backupSources.name);

export const getBackupSourceById = async (
  db: Database,
  id: string,
): Promise<BackupSource | undefined> => {
  const [row] = await db
    .select()
    .from(backupSources)
    .where(eq(backupSources.id, id));

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

/**
 * Item counts by status for a source. The queue is source-wide (one active
 * job per source), so these describe the job's remaining work too.
 */
export const getQueueCounts = async (
  db: Database | Tx,
  sourceId: string,
): Promise<QueueCounts> => {
  const rows = await db
    .select({
      status: discoveryQueueItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.sourceId, sourceId))
    .groupBy(discoveryQueueItems.status);

  const counts = emptyCounts();
  for (const row of rows) counts[row.status] = row.count;

  return counts;
};

/**
 * Inserts paths, ignoring any already queued for the source (matched on
 * normalized path, so differently-cased spellings dedupe). Returns every
 * requested path's row — new or pre-existing — flagged with `created`.
 */
const insertQueuePaths = async (
  db: Database | Tx,
  input: {
    sourceId: string;
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
        sourceId: input.sourceId,
        jobId: input.jobId,
        path: p.path,
        normalizedPath: p.normalizedPath,
        priority: input.priority ?? 0,
      })),
    )
    .onConflictDoNothing({
      target: [
        discoveryQueueItems.sourceId,
        discoveryQueueItems.normalizedPath,
      ],
    })
    .returning();

  const createdIds = new Set(inserted.map((row) => row.id));

  const rows = await db
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.sourceId, input.sourceId),
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
const expireLeases = async (tx: Tx, sourceId: string): Promise<void> => {
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
        eq(t.sourceId, sourceId),
        eq(t.status, 'in_progress'),
        sql`${t.leaseExpiresAt} < now()`,
      ),
    );
};

// -- discovery jobs ---------------------------------------------------------

export type CreateDiscoveryJobInput = {
  sourceId: string;
  root: QueuePath;
};

/**
 * Creates a pending job and seeds the queue with its root directory in one
 * transaction. Fails with `conflict` if the source already has an active
 * job. If the root was already queued by an earlier job it is left as is.
 */
export const createDiscoveryJob = async (
  db: Database,
  input: CreateDiscoveryJobInput,
): Promise<DiscoveryJob> => {
  try {
    return await db.transaction(async (tx) => {
      const [source] = await tx
        .select({ id: backupSources.id })
        .from(backupSources)
        .where(eq(backupSources.id, input.sourceId));

      if (!source) {
        throw new DiscoveryError('not_found', 'backup source not found');
      }

      const [job] = await tx
        .insert(discoveryJobs)
        .values({
          sourceId: input.sourceId,
          rootPath: input.root.path,
          normalizedRootPath: input.root.normalizedPath,
        })
        .returning();

      await insertQueuePaths(tx, {
        sourceId: input.sourceId,
        jobId: job.id,
        paths: [input.root],
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
  db: Database,
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

const ACTIVE_JOB_STATUSES: DiscoveryJobStatus[] = ['pending', 'running'];

/**
 * Moves a job to a terminal status. `pending`/`running` are the only legal
 * starting points — `completed`, `failed` and `cancelled` are final.
 */
export const transitionDiscoveryJob = async (
  db: Database,
  id: string,
  to: Extract<DiscoveryJobStatus, 'failed' | 'cancelled'>,
  error?: string,
): Promise<DiscoveryJob> => {
  const [row] = await db
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

  if (row) return row;

  const existing = await getDiscoveryJobById(db, id);
  if (!existing)
    throw new DiscoveryError('not_found', 'discovery job not found');

  throw new DiscoveryError(
    'conflict',
    `job is already ${existing.status}; cannot move to ${to}`,
  );
};

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
      .for('update');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError(
        'conflict',
        `job is already ${job.status}; cannot complete`,
      );
    }

    await expireLeases(tx, job.sourceId);
    const counts = await getQueueCounts(tx, job.sourceId);

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
  sourceId: string;
  jobId?: string;
  status?: DiscoveryQueueItemStatus;
};

const LIST_QUEUE_ITEMS_LIMIT = 500;

export const listQueueItems = async (
  db: Database,
  options: ListQueueItemsOptions,
): Promise<DiscoveryQueueItem[]> =>
  db
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.sourceId, options.sourceId),
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

export type EnqueueQueueItemsInput = {
  jobId: string;
  paths: QueuePath[];
  priority?: number;
};

/** Enqueues directories for an active job; already-queued paths are skipped. */
export const enqueueQueueItems = async (
  db: Database,
  input: EnqueueQueueItemsInput,
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> => {
  const job = await getDiscoveryJobById(db, input.jobId);
  if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

  if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
    throw new DiscoveryError('conflict', `job is ${job.status}`);
  }

  return insertQueuePaths(db, {
    sourceId: job.sourceId,
    jobId: job.id,
    paths: input.paths,
    priority: input.priority,
  });
};

export type ClaimQueueItemInput = {
  jobId: string;
  workerId: string;
  leaseSeconds: number;
};

/**
 * Atomically claims the highest-priority eligible directory for an active
 * job, or returns undefined when there is none. Expired leases are
 * reclaimed first, so abandoned work is picked up by the next caller.
 * `FOR UPDATE SKIP LOCKED` means concurrent claimers never receive the same
 * row — each competing transaction skips rows another already locked. The
 * first claim also moves the job from pending to running. Claiming takes
 * from the whole source queue and re-stamps the item with this job.
 */
export const claimNextQueueItem = async (
  db: Database,
  input: ClaimQueueItemInput,
): Promise<DiscoveryQueueItem | undefined> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, input.jobId));

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError('conflict', `job is ${job.status}`);
    }

    await expireLeases(tx, job.sourceId);

    const t = discoveryQueueItems;
    const [next] = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          eq(t.sourceId, job.sourceId),
          eq(t.status, 'queued'),
          lte(t.availableAt, sql`now()`),
        ),
      )
      .orderBy(desc(t.priority), asc(t.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) return undefined;

    const [item] = await tx
      .update(t)
      .set({
        status: 'in_progress',
        jobId: job.id,
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

    return item;
  });

/** Matches only the live, current claim — wrong token or expired lease misses. */
const activeClaim = (id: string, claimToken: string) =>
  and(
    eq(discoveryQueueItems.id, id),
    eq(discoveryQueueItems.status, 'in_progress'),
    eq(discoveryQueueItems.claimToken, claimToken),
    gt(discoveryQueueItems.leaseExpiresAt, sql`now()`),
  );

/** A guarded write matched nothing: either no such item or the claim is dead. */
const claimMissError = async (
  db: Database | Tx,
  id: string,
): Promise<DiscoveryError> => {
  const [row] = await db
    .select({ id: discoveryQueueItems.id })
    .from(discoveryQueueItems)
    .where(eq(discoveryQueueItems.id, id));

  return row
    ? new DiscoveryError(
        'conflict',
        'claim is no longer valid (wrong token, lease expired, or item not in progress)',
      )
    : new DiscoveryError('not_found', 'queue item not found');
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

    const children = item.jobId
      ? await insertQueuePaths(tx, {
          sourceId: item.sourceId,
          jobId: item.jobId,
          paths: input.discoveredPaths ?? [],
        })
      : [];

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
    .where(and(eq(t.id, id), eq(t.status, 'failed')))
    .returning();

  if (row) return row;

  const existing = await getQueueItemById(db, id);
  if (!existing) throw new DiscoveryError('not_found', 'queue item not found');

  throw new DiscoveryError(
    'conflict',
    `only failed items can be retried (item is ${existing.status})`,
  );
};
