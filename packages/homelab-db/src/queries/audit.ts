import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../client';
import {
  auditEvents,
  type AuditActorType,
  type AuditEvent,
  type AuditEventType,
} from '../schema/discovery';
import type { Tx } from './shared';

export type Actor = { type: AuditActorType; id?: string | null };

export type AuditEventInput = {
  eventType: AuditEventType;
  actor: Actor;
  sourceId?: string | null;
  jobId?: string | null;
  queueItemId?: string | null;
  exclusionRuleId?: string | null;
  inventoryItemId?: string | null;
  destinationId?: string | null;
  backupJobId?: string | null;
  backupJobItemId?: string | null;
  details?: Record<string, unknown> | null;
};

/**
 * Appends an event. Takes a transaction, not a Database: an event must be
 * written by the same transaction as the state change it describes, so a
 * rolled-back change never leaves an event claiming it succeeded.
 */
export const insertAuditEvent = async (
  tx: Tx,
  event: AuditEventInput,
): Promise<AuditEvent> => {
  const [row] = await tx
    .insert(auditEvents)
    .values({
      eventType: event.eventType,
      actorType: event.actor.type,
      actorId: event.actor.id ?? null,
      sourceId: event.sourceId ?? null,
      jobId: event.jobId ?? null,
      queueItemId: event.queueItemId ?? null,
      exclusionRuleId: event.exclusionRuleId ?? null,
      inventoryItemId: event.inventoryItemId ?? null,
      destinationId: event.destinationId ?? null,
      backupJobId: event.backupJobId ?? null,
      backupJobItemId: event.backupJobItemId ?? null,
      details: event.details ?? null,
    })
    .returning();

  return row;
};

export type ListAuditEventsOptions = {
  sourceId?: string;
  jobId?: string;
  exclusionRuleId?: string;
  inventoryItemId?: string;
  destinationId?: string;
  backupJobId?: string;
  backupJobItemId?: string;
  eventType?: AuditEventType;
  since?: Date;
  until?: Date;
  /** Keyset cursor: the id of the last event of the previous page. */
  before?: string;
  limit?: number;
};

const LIST_AUDIT_DEFAULT_LIMIT = 100;
const LIST_AUDIT_MAX_LIMIT = 500;

/** Newest first, ordered by (createdAt, id) so the cursor is stable. */
export const listAuditEvents = async (
  db: Database,
  options: ListAuditEventsOptions = {},
): Promise<AuditEvent[]> => {
  const t = auditEvents;
  const filters: (SQL | undefined)[] = [
    options.sourceId ? eq(t.sourceId, options.sourceId) : undefined,
    options.jobId ? eq(t.jobId, options.jobId) : undefined,
    options.exclusionRuleId
      ? eq(t.exclusionRuleId, options.exclusionRuleId)
      : undefined,
    options.inventoryItemId
      ? eq(t.inventoryItemId, options.inventoryItemId)
      : undefined,
    options.destinationId
      ? eq(t.destinationId, options.destinationId)
      : undefined,
    options.backupJobId ? eq(t.backupJobId, options.backupJobId) : undefined,
    options.backupJobItemId
      ? eq(t.backupJobItemId, options.backupJobItemId)
      : undefined,
    options.eventType ? eq(t.eventType, options.eventType) : undefined,
    options.since ? gte(t.createdAt, options.since) : undefined,
    options.until ? lte(t.createdAt, options.until) : undefined,
    options.before
      ? sql`(${t.createdAt}, ${t.id}) < (select a.created_at, a.id from audit_events a where a.id = ${options.before})`
      : undefined,
  ];

  return db
    .select()
    .from(t)
    .where(and(...filters))
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(
      Math.min(options.limit ?? LIST_AUDIT_DEFAULT_LIMIT, LIST_AUDIT_MAX_LIMIT),
    );
};
