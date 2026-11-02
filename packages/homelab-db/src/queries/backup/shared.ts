import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupJobItems,
  backupJobs,
  type BackupJobStatus,
} from '../../schema/backup';
import type { Tx } from '../shared';

/**
 * A rule violation the caller can act on: the row is missing (`not_found`)
 * or the request conflicts with current state (`conflict`) — a duplicate
 * name, an illegal transition, a lost lease.
 */
export class BackupError extends Error {
  constructor(
    readonly code: 'not_found' | 'conflict',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export const ACTIVE_BACKUP_JOB_STATUSES: BackupJobStatus[] = [
  'planned',
  'running',
];

export const BACKUP_FILE_MAX_ATTEMPTS = 3;
export const BACKUP_DIRECTORY_MAX_ATTEMPTS = 5;

export const backupJobIsActive = (jobIdColumn: typeof backupJobItems.jobId) =>
  sql`exists (select 1 from ${backupJobs} where ${backupJobs.id} = ${jobIdColumn} and ${backupJobs.status} in ('planned', 'running'))`;

/**
 * Matches only the live, current claim on an item whose job is still active:
 * a wrong token, an expired lease or a finished job all miss, so a worker
 * cannot keep writing to a job that was cancelled or failed under it.
 */
export const activeItemClaim = (id: string, claimToken: string) =>
  and(
    eq(backupJobItems.id, id),
    eq(backupJobItems.status, 'in_progress'),
    eq(backupJobItems.claimToken, claimToken),
    gt(backupJobItems.leaseExpiresAt, sql`now()`),
    backupJobIsActive(backupJobItems.jobId),
  );

/**
 * The item as already settled by this very claim (same token, now `status`),
 * for answering a retried complete/fail whose first response was lost. Only
 * the claim's own token matches: another worker's attempt still conflicts.
 * Settling keeps the token for this reason; a requeue clears it.
 */
export const settledByItemClaim = async (
  db: Database | Tx,
  id: string,
  claimToken: string,
  statuses: (typeof backupJobItems.$inferSelect.status)[],
) => {
  const [row] = await db
    .select()
    .from(backupJobItems)
    .where(
      and(
        eq(backupJobItems.id, id),
        sql`${backupJobItems.status} in ${statuses}`,
        eq(backupJobItems.claimToken, claimToken),
      ),
    );

  return row;
};

/** A guarded write matched nothing: either no such item or the claim is dead. */
export const itemClaimMissError = async (
  db: Database | Tx,
  id: string,
): Promise<BackupError> => {
  const [row] = await db
    .select({ jobStatus: backupJobs.status })
    .from(backupJobItems)
    .innerJoin(backupJobs, eq(backupJobs.id, backupJobItems.jobId))
    .where(eq(backupJobItems.id, id));

  if (!row) return new BackupError('not_found', 'backup job item not found');

  if (!ACTIVE_BACKUP_JOB_STATUSES.includes(row.jobStatus)) {
    return new BackupError(
      'conflict',
      `job is ${row.jobStatus}; its items can no longer be changed`,
    );
  }

  return new BackupError(
    'conflict',
    'claim is no longer valid (wrong token, lease expired, or item not in progress)',
  );
};
