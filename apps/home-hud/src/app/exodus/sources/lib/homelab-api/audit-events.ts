import { getJson } from './http';

export type AuditEventType =
  | 'exclusion_rule.created'
  | 'exclusion_rule.updated'
  | 'exclusion_rule.deleted'
  | 'queue_items.excluded'
  | 'queue_items.inventoried'
  | 'inventory_item.created'
  | 'inventory_item.recommendation_changed'
  | 'inventory_item.decision_changed'
  | 'inventory_item.promoted'
  | 'skip.acknowledged'
  | 'skip.unacknowledged'
  | 'on_disk.reviewed'
  | 'on_disk.unreviewed'
  | 'source_connection.updated'
  | 'source_connection.deleted'
  | 'backup_destination.created'
  | 'backup_destination.updated'
  | 'backup_destination.enabled'
  | 'backup_destination.disabled'
  | 'backup_destination.validated'
  | 'backup_destination.unhealthy'
  | 'backup_job.created'
  | 'backup_job.started'
  | 'backup_job.completed'
  | 'backup_job.completed_with_issues'
  | 'backup_job.cancelled'
  | 'backup_job.failed'
  | 'backup_job.stalled'
  | 'backup_job.resumed'
  | 'backup_job_item.verified'
  | 'backup_job_item.attempt_failed'
  | 'backup_job_item.blocked'
  | 'backup_job_item.failed'
  | 'backup_job_item.retried'
  | 'backup_job_items.lease_expired';

export interface AuditEvent {
  id: string;
  sourceId: string | null;
  jobId: string | null;
  exclusionRuleId: string | null;
  inventoryItemId: string | null;
  eventType: AuditEventType;
  actorType: 'human' | 'openclaw' | 'system';
  actorId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditQuery {
  sourceId?: string;
  eventType?: AuditEventType;
  /** The id of the last event of the previous page. */
  before?: string;
  limit?: number;
}

/** A page of the audit log, newest first. */
export async function getAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  return getJson<AuditEvent[]>(`/audit-events?${params}`);
}
