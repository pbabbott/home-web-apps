import { getJson } from './http';

export type AuditEventType =
  | 'exclusion_rule.created'
  | 'exclusion_rule.updated'
  | 'exclusion_rule.deleted'
  | 'inventory_item.review_changed'
  | 'inventory_item.review_bulk_changed'
  | 'queue_items.excluded';

export interface AuditEvent {
  id: string;
  sourceId: string | null;
  jobId: string | null;
  inventoryItemId: string | null;
  exclusionRuleId: string | null;
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
