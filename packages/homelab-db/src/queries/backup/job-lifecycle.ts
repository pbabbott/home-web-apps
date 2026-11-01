import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupJobItems,
  backupJobs,
  type BackupJob,
  type BackupJobStalledReason,
  type BackupJobStatus,
} from '../../schema/backup';
import { insertAuditEvent, type Actor } from '../audit';
import { getBackupItemCounts } from './job-summaries';
import { getBackupJob } from './jobs';
import { expireBackupLeases } from './leases';
import { ACTIVE_BACKUP_JOB_STATUSES, BackupError } from './shared';

/**
 * Cancels or fails an active job (human actions). Leases are released in the
 * same transaction: an in-progress item goes back to `queued` with no claim,
 * so a late worker is rejected (its token is gone) and the item stays on
 * record as work that was never finished. Queued, failed and blocked items
 * are left as they are.
 */
export const transitionBackupJob = async (
  db: Database,
  id: string,
  to: Extract<BackupJobStatus, 'failed' | 'cancelled'>,
  actor: Actor,
  error?: string,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(backupJobs)
      .set({
        status: to,
        error: error ?? null,
        stalledReason: null,
        stalledSince: null,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(backupJobs.id, id),
          inArray(backupJobs.status, ACTIVE_BACKUP_JOB_STATUSES),
        ),
      )
      .returning();

    if (!row) {
      const existing = await getBackupJob(tx, id);
      if (!existing) throw new BackupError('not_found', 'backup job not found');

      throw new BackupError(
        'conflict',
        `job is already ${existing.status}; cannot move to ${to}`,
      );
    }

    const t = backupJobItems;
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

    await insertAuditEvent(tx, {
      eventType: to === 'failed' ? 'backup_job.failed' : 'backup_job.cancelled',
      actor,
      sourceId: row.sourceId,
      destinationId: row.destinationId,
      backupJobId: id,
      details: error ? { error } : null,
    });

    return row;
  });

export type CompleteBackupJobResult = {
  job: BackupJob;
  /** False when the job was already final or still has queued or in-progress work. */
  finished: boolean;
};

/**
 * The final-outcome check, run when a claim finds `queue_empty`. Once no item
 * is `queued` or `in_progress` (after reclaiming expired leases) the job is
 * `completed` if every item is verified, skipped or excluded, and
 * `completed_with_issues` if any is failed or blocked. A completed job never
 * implies full coverage; that is the coverage report's job. Safe to call on a
 * job that is not done: it answers `finished: false` and changes nothing.
 */
export const completeBackupJobIfDone = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<CompleteBackupJobResult> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      return { job, finished: false };
    }

    await expireBackupLeases(tx, job);
    const counts = await getBackupItemCounts(tx, job.id);
    if (counts.queued > 0 || counts.in_progress > 0) {
      return { job, finished: false };
    }

    const status: BackupJobStatus =
      counts.failed > 0 || counts.blocked > 0
        ? 'completed_with_issues'
        : 'completed';

    const [done] = await tx
      .update(backupJobs)
      .set({
        status,
        stalledReason: null,
        stalledSince: null,
        startedAt: sql`coalesce(${backupJobs.startedAt}, now())`,
        finishedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType:
        status === 'completed'
          ? 'backup_job.completed'
          : 'backup_job.completed_with_issues',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { items: counts },
    });

    return { job: done, finished: true };
  });

/**
 * Marks an active job stalled: claims are paused, no attempts are spent and
 * the job stays `running`. Audited when the job becomes stalled or its reason
 * changes, not on every repeat.
 */
export const stallBackupJob = async (
  db: Database,
  id: string,
  reason: BackupJobStalledReason,
  actor: Actor,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!ACTIVE_BACKUP_JOB_STATUSES.includes(job.status)) {
      throw new BackupError('conflict', `job is ${job.status}`);
    }
    if (job.stalledReason === reason) return job;

    const [row] = await tx
      .update(backupJobs)
      .set({
        stalledReason: reason,
        stalledSince: job.stalledReason ? backupJobs.stalledSince : sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_job.stalled',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { reason },
    });

    return row;
  });

/** Clears a stall once the destination or source answers again. */
export const resumeBackupJob = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<BackupJob> =>
  db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(backupJobs)
      .where(eq(backupJobs.id, id))
      .for('no key update');

    if (!job) throw new BackupError('not_found', 'backup job not found');
    if (!job.stalledReason) return job;

    const [row] = await tx
      .update(backupJobs)
      .set({ stalledReason: null, stalledSince: null, updatedAt: sql`now()` })
      .where(eq(backupJobs.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'backup_job.resumed',
      actor,
      sourceId: job.sourceId,
      destinationId: job.destinationId,
      backupJobId: id,
      details: { wasStalledFor: job.stalledReason },
    });

    return row;
  });
