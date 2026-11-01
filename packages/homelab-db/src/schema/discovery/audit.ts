import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { dateTime } from './shared';
import { auditActorTypeEnum } from './enums';

/**
 * Append-only record of changes to exclusion and review state. The id columns
 * deliberately have no foreign keys: the log must outlive the rows it
 * describes (a removed rule, a deleted source). `details` holds before/after
 * values and is kept small by the callers.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id'),
    jobId: uuid('job_id'),
    queueItemId: uuid('queue_item_id'),
    exclusionRuleId: uuid('exclusion_rule_id'),
    inventoryItemId: uuid('inventory_item_id'),
    destinationId: uuid('destination_id'),
    backupJobId: uuid('backup_job_id'),
    backupJobItemId: uuid('backup_job_item_id'),
    eventType: text('event_type').$type<AuditEventType>().notNull(),
    actorType: auditActorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_events_created_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('audit_events_source_idx').on(table.sourceId, table.createdAt.desc()),
    index('audit_events_job_idx').on(table.jobId, table.createdAt.desc()),
    index('audit_events_rule_idx').on(
      table.exclusionRuleId,
      table.createdAt.desc(),
    ),
    index('audit_events_inventory_item_idx').on(
      table.inventoryItemId,
      table.createdAt.desc(),
    ),
    index('audit_events_destination_idx').on(
      table.destinationId,
      table.createdAt.desc(),
    ),
    index('audit_events_backup_job_idx').on(
      table.backupJobId,
      table.createdAt.desc(),
    ),
  ],
);

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

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];

export const auditEventSelectSchema = createSelectSchema(auditEvents, {
  createdAt: dateTime,
});
