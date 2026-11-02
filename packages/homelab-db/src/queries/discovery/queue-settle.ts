import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  type DiscoveryQueueItem,
  type QueueItemResult,
} from '../../schema/discovery';
import { DiscoveryError, retryDelaySeconds } from '../shared';
import { refreshAfterSkips } from './queue-enqueue';
import {
  ACTIVE_JOB_STATUSES,
  activeClaim,
  claimMissError,
  jobIsActive,
  settledByClaim,
} from './claims';
import { insertQueuePaths, type QueuePath } from './queue-helpers';
import type { Tx } from '../shared';

export type CompleteQueueItemInput = {
  claimToken: string;
  /** Child directories found while inspecting this one. */
  discoveredPaths?: QueuePath[];
  /**
   * Child directories the worker could not read. Each carries a `failure` and is
   * recorded as a `failed` item without being claimed.
   */
  unreadablePaths?: QueuePath[];
  /** What the worker concluded, including paths it saw but chose not to queue. */
  result?: QueueItemResult;
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
        ...(input.result ? { result: input.result } : {}),
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(activeClaim(id, input.claimToken))
      .returning();

    if (!item) {
      // A retry after a lost response: the first call already completed it and
      // enqueued its children, so report those rather than conflicting.
      const replay = await settledByClaim(
        tx,
        id,
        input.claimToken,
        'completed',
      );
      if (!replay) throw await claimMissError(tx, id);

      return {
        item: replay,
        children: await existingChildren(tx, replay, input),
      };
    }

    const inserted = await insertQueuePaths(tx, {
      jobId: item.jobId,
      paths: [
        ...(input.discoveredPaths ?? []),
        ...(input.unreadablePaths ?? []),
      ],
    });
    const [job] = await tx
      .select({ id: discoveryJobs.id, sourceId: discoveryJobs.sourceId })
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, item.jobId));

    return { item, children: await refreshAfterSkips(tx, job, inserted) };
  });

/** Rows already queued for a replayed completion's paths; nothing is inserted. */
const existingChildren = async (
  tx: Tx,
  item: DiscoveryQueueItem,
  input: CompleteQueueItemInput,
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> => {
  const paths = [
    ...(input.discoveredPaths ?? []),
    ...(input.unreadablePaths ?? []),
  ];
  if (paths.length === 0) return [];

  const rows = await tx
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.jobId, item.jobId),
        inArray(
          discoveryQueueItems.normalizedPath,
          paths.map((p) => p.normalizedPath),
        ),
      ),
    );

  return rows.map((row) => ({ item: row, created: false }));
};

export type FailQueueItemInput = {
  claimToken: string;
  error: string;
  retryable: boolean;
};

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

/**
 * Hands a claim back without finishing it: the item returns to `queued` at
 * once and the attempt is refunded, since the worker chose to stop rather than
 * failing or vanishing. Lets a bounded run leave nothing claimed.
 */
export const releaseQueueItem = async (
  db: Database,
  id: string,
  input: { claimToken: string },
): Promise<DiscoveryQueueItem> => {
  const t = discoveryQueueItems;

  const [row] = await db
    .update(t)
    .set({
      status: 'queued',
      attemptCount: sql`greatest(${t.attemptCount} - 1, 0)`,
      lastError: sql`'released by ' || coalesce(${t.claimedBy}, 'unknown')`,
      availableAt: sql`now()`,
      claimedBy: null,
      claimToken: null,
      leaseExpiresAt: null,
      updatedAt: sql`now()`,
    })
    .where(activeClaim(id, input.claimToken))
    .returning();

  if (!row) throw await claimMissError(db, id);

  return row;
};

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

  if (row) return row;

  const replay = await settledByClaim(db, id, input.claimToken, 'skipped');
  if (!replay) throw await claimMissError(db, id);

  return replay;
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

  return db.transaction(async (tx) => {
    // Share-lock the job first so a concurrent cancel/fail/complete cannot
    // interleave with the requeue.
    const [owner] = await tx
      .select({ jobId: t.jobId })
      .from(t)
      .where(eq(t.id, id));

    if (owner) {
      await tx
        .select({ id: discoveryJobs.id })
        .from(discoveryJobs)
        .where(eq(discoveryJobs.id, owner.jobId))
        .for('share');
    }

    const [row] = await tx
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

    const [existing] = await tx
      .select({ status: t.status, jobStatus: discoveryJobs.status })
      .from(t)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, t.jobId))
      .where(eq(t.id, id));

    if (!existing)
      throw new DiscoveryError('not_found', 'queue item not found');

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
  });
};

/**
 * Human-requested retry of every `failed` item of an active job, each granted
 * exactly one more attempt as in `retryQueueItem`. Returns the requeued items
 * (none is fine: nothing had failed).
 */
export const retryFailedQueueItems = async (
  db: Database,
  jobId: string,
): Promise<DiscoveryQueueItem[]> => {
  const t = discoveryQueueItems;

  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(discoveryJobs)
      .where(eq(discoveryJobs.id, jobId))
      .for('share');

    if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw new DiscoveryError(
        'conflict',
        `job is ${job.status}; start a new discovery job to explore these directories again`,
      );
    }

    return tx
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
      .where(and(eq(t.jobId, jobId), eq(t.status, 'failed')))
      .returning();
  });
};
