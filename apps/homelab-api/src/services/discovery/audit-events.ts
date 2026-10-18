import {
  listAuditEvents as listAuditEventRows,
  type AuditEvent,
  type AuditEventType,
} from '@abbottland/homelab-db';
import { db } from '../../db';

export async function listAuditEvents(filters: {
  sourceId?: string;
  jobId?: string;
  inventoryItemId?: string;
  exclusionRuleId?: string;
  eventType?: AuditEventType;
  since?: string;
  until?: string;
  before?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  return listAuditEventRows(db, {
    ...filters,
    since: filters.since ? new Date(filters.since) : undefined,
    until: filters.until ? new Date(filters.until) : undefined,
  });
}
