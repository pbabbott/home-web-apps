import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  type DiscoveryQueueItem,
} from '../../schema/discovery';
import { skipExcludedQueueItems } from '../exclusion-rules';
import { skipInventoriedQueueItems } from '../inventory-items';
import { DiscoveryError } from '../shared';
import { ACTIVE_JOB_STATUSES } from './claims';
import { insertQueuePaths, type QueuePath } from './queue-helpers';
import type { Tx } from '../shared';

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

    const inserted = await insertQueuePaths(tx, {
      jobId: job.id,
      paths: input.paths,
      priority: input.priority,
    });

    return refreshAfterSkips(tx, job, inserted);
  });

/**
 * Applies exclusion rules and approved directory inventory items to freshly
 * queued paths in the same transaction, so work under an `exclude_subtree`
 * rule or inside an approved directory is `skipped` the moment it is queued
 * rather than waiting for the next claim. Claim rechecks too, because rules
 * and approvals can change after work was queued. Returns the rows as they now stand.
 */
export const refreshAfterSkips = async (
  tx: Tx,
  job: { id: string; sourceId: string },
  queued: { item: DiscoveryQueueItem; created: boolean }[],
): Promise<{ item: DiscoveryQueueItem; created: boolean }[]> => {
  if (queued.length === 0) return queued;

  const scope = { jobId: job.id, sourceId: job.sourceId };
  const skipped =
    (await skipExcludedQueueItems(tx, scope)) +
    (await skipInventoriedQueueItems(tx, scope));
  if (skipped === 0) return queued;

  const rows = await tx
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.jobId, job.id),
        inArray(
          discoveryQueueItems.id,
          queued.map((q) => q.item.id),
        ),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));

  return queued.map((q) => ({ ...q, item: byId.get(q.item.id) ?? q.item }));
};
