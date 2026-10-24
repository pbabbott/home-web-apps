import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  type DiscoveryJobStatus,
} from '../../schema/discovery';
import { DiscoveryError } from '../shared';
import type { Tx } from '../shared';

export const ACTIVE_JOB_STATUSES: DiscoveryJobStatus[] = ['pending', 'running'];

export const jobIsActive = (jobIdColumn: typeof discoveryQueueItems.jobId) =>
  sql`exists (select 1 from ${discoveryJobs} where ${discoveryJobs.id} = ${jobIdColumn} and ${discoveryJobs.status} in ('pending', 'running'))`;

/**
 * Matches only the live, current claim on an item whose job is still active:
 * a wrong token, an expired lease or a finished job all miss, so a worker
 * cannot keep writing to a job that was cancelled or failed under it.
 */
export const activeClaim = (id: string, claimToken: string) =>
  and(
    eq(discoveryQueueItems.id, id),
    eq(discoveryQueueItems.status, 'in_progress'),
    eq(discoveryQueueItems.claimToken, claimToken),
    gt(discoveryQueueItems.leaseExpiresAt, sql`now()`),
    jobIsActive(discoveryQueueItems.jobId),
  );

/**
 * The item as already settled by this very claim (same token, now `status`),
 * for answering a retried complete/skip whose first response was lost. Only
 * the claim's own token matches: another worker's attempt still conflicts.
 */
export const settledByClaim = async (
  db: Database | Tx,
  id: string,
  claimToken: string,
  status: 'completed' | 'skipped',
) => {
  const [row] = await db
    .select()
    .from(discoveryQueueItems)
    .where(
      and(
        eq(discoveryQueueItems.id, id),
        eq(discoveryQueueItems.status, status),
        eq(discoveryQueueItems.claimToken, claimToken),
      ),
    );

  return row;
};

/** A guarded write matched nothing: either no such item or the claim is dead. */
export const claimMissError = async (
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
