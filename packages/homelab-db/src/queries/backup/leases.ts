import { and, eq, sql } from 'drizzle-orm';
import { backupJobItems } from '../../schema/backup';
import { insertAuditEvent } from '../audit';
import { MAX_AUDITED_ITEM_IDS, type Tx } from '../shared';

/**
 * Returns abandoned work to circulation: any in_progress item whose lease has
 * run out goes back to `queued`, or to `failed` once it has used all its
 * attempts. An abandoned claim spends its attempt. attemptCount, lastError
 * (worker and attempt) and lastClaimedBy are kept for debugging. One batched
 * audit event covers every item expired in this call.
 */
export const expireBackupLeases = async (
  tx: Tx,
  jobId: string,
): Promise<{ expired: number; failed: number }> => {
  const t = backupJobItems;

  const rows = await tx
    .update(t)
    .set({
      status: sql`case when ${t.attemptCount} >= ${t.maxAttempts} then 'failed'::backup_job_item_status else 'queued'::backup_job_item_status end`,
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
    )
    .returning({ id: t.id, status: t.status });

  const failed = rows.filter((row) => row.status === 'failed').length;

  if (rows.length > 0) {
    await insertAuditEvent(tx, {
      eventType: 'backup_job_items.lease_expired',
      actor: { type: 'system' },
      backupJobId: jobId,
      details: {
        count: rows.length,
        failed,
        itemIds: rows.slice(0, MAX_AUDITED_ITEM_IDS).map((row) => row.id),
      },
    });
  }

  return { expired: rows.length, failed };
};
