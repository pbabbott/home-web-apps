import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import { isUniqueViolation } from '../../pg-errors';
import {
  discoveryJobs,
  discoveryQueueItems,
  sources,
  type DiscoveryJob,
  type DiscoveryJobStatus,
} from '../../schema/discovery';
import { ACTIVE_JOB_STATUSES } from './claims';
import { DiscoveryError } from './errors';
import { upsertInventoryItems, type InventoryPath } from './inventory-upsert';
import {
  expireLeases,
  getQueueCounts,
  insertQueuePaths,
  type QueuePath,
} from './queue-helpers';
import type { Tx } from './tx';

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
