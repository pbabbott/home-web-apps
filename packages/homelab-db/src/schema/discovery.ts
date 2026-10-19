import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { hosts } from './hosts';

export const sourceTypeEnum = pgEnum('source_type', ['windows']);

export const discoveryJobStatusEnum = pgEnum('discovery_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const discoveryQueueItemStatusEnum = pgEnum(
  'discovery_queue_item_status',
  ['queued', 'in_progress', 'completed', 'failed', 'skipped'],
);

export const inventoryItemTypeEnum = pgEnum('inventory_item_type', [
  'file',
  'directory',
]);

export const exclusionRuleScopeEnum = pgEnum('exclusion_rule_scope', [
  'selective_only',
  'exclude_subtree',
]);

export const reviewDispositionEnum = pgEnum('review_disposition', [
  'candidate',
  'not_needed',
  'needs_review',
]);

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'human',
  'openclaw',
  'system',
]);

/**
 * A machine/filesystem being inventoried for the exodus file migration.
 * hostId optionally ties it to a registered host (join on hosts.id for
 * name/IP); null for a machine that isn't registered. RESTRICT so deleting a
 * host can't silently wipe its discovery history.
 */
export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  hostId: uuid('host_id').references(() => hosts.id, { onDelete: 'restrict' }),
  sourceType: sourceTypeEnum('source_type').notNull().default('windows'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One discovery run over a source, rooted at `rootPath`. The partial unique
 * index allows at most one active (pending/running) job per source: two
 * concurrent walks of the same source would only duplicate work and fight
 * over the same inventory rows.
 */
export const discoveryJobs = pgTable(
  'discovery_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    rootPath: text('root_path').notNull(),
    normalizedRootPath: text('normalized_root_path').notNull(),
    status: discoveryJobStatusEnum('status').notNull().default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('discovery_jobs_one_active_per_source')
      .on(table.sourceId)
      .where(sql`${table.status} in ('pending', 'running')`),
  ],
);

/**
 * One directory to explore within a discovery job. The job owns the
 * lifecycle; the item tracks only its own unit of work. `path` keeps the
 * display form (original case); `normalizedPath` is the lowercased canonical
 * form, unique per job. An item is leased to a worker while `in_progress`:
 * `claimToken` identifies the current claim and `leaseExpiresAt` lets
 * abandoned work be reclaimed. The source is reached through the job.
 */
export const discoveryQueueItems = pgTable(
  'discovery_queue_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => discoveryJobs.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    status: discoveryQueueItemStatusEnum('status').notNull().default('queued'),
    priority: integer('priority').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedBy: text('claimed_by'),
    claimToken: uuid('claim_token'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('discovery_queue_items_job_path_unique').on(
      table.jobId,
      table.normalizedPath,
    ),
    index('discovery_queue_items_claim_idx').on(
      table.jobId,
      table.status,
      table.priority.desc(),
      table.availableAt,
    ),
    // Legal states, enforced by the database as well as the queries.
    check(
      'discovery_queue_items_attempts_check',
      sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= ${table.maxAttempts}`,
    ),
    check(
      'discovery_queue_items_lease_check',
      sql`${table.status} <> 'in_progress' or (${table.claimedBy} is not null and ${table.claimToken} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
  ],
);

/**
 * A file or directory found while exploring a source. Identity is the
 * source + normalized (lowercased) path, so rediscovery by any job updates
 * the same row. Only filesystem facts are overwritten on rediscovery; the
 * human review columns (`reviewDisposition`, `reviewedAt`, `reviewedBy`,
 * `reviewNote`) and any copy state added later are left alone.
 * `firstJobId`/`lastJobId` record which runs found it.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    firstJobId: uuid('first_job_id').references(() => discoveryJobs.id, {
      onDelete: 'set null',
    }),
    lastJobId: uuid('last_job_id').references(() => discoveryJobs.id, {
      onDelete: 'set null',
    }),
    itemType: inventoryItemTypeEnum('item_type').notNull(),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    parentPath: text('parent_path'),
    normalizedParentPath: text('normalized_parent_path'),
    name: text('name').notNull(),
    extension: text('extension'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    modifiedAt: timestamp('modified_at', { withTimezone: true }),
    reviewDisposition: reviewDispositionEnum('review_disposition')
      .notNull()
      .default('needs_review'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewNote: text('review_note'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('inventory_items_source_path_unique').on(
      table.sourceId,
      table.normalizedPath,
    ),
    index('inventory_items_parent_idx').on(
      table.sourceId,
      table.normalizedParentPath,
    ),
    index('inventory_items_last_job_idx').on(table.lastJobId),
    index('inventory_items_type_idx').on(table.sourceId, table.itemType),
    index('inventory_items_review_idx').on(
      table.sourceId,
      table.reviewDisposition,
    ),
    check(
      'inventory_items_size_check',
      sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`,
    ),
  ],
);

/**
 * A persistent rule that limits discovery. `sourceId` null means the rule is
 * global (applies to every source). `exclude_subtree` drops the path and
 * everything beneath it; `selective_only` only stops the path itself from
 * being a backup candidate while its descendants are still explored. One rule
 * per path per owner (source or global); NULLS NOT DISTINCT makes the unique
 * index cover global rules too.
 */
export const exclusionRules = pgTable(
  'exclusion_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id, {
      onDelete: 'cascade',
    }),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    scope: exclusionRuleScopeEnum('scope').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('exclusion_rules_owner_path_unique')
      .on(table.sourceId, table.normalizedPath)
      .nullsNotDistinct(),
    index('exclusion_rules_path_idx').on(table.normalizedPath),
  ],
);

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
    inventoryItemId: uuid('inventory_item_id'),
    exclusionRuleId: uuid('exclusion_rule_id'),
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
    index('audit_events_inventory_item_idx').on(
      table.inventoryItemId,
      table.createdAt.desc(),
    ),
    index('audit_events_rule_idx').on(
      table.exclusionRuleId,
      table.createdAt.desc(),
    ),
  ],
);

export type AuditEventType =
  | 'exclusion_rule.created'
  | 'exclusion_rule.updated'
  | 'exclusion_rule.deleted'
  | 'inventory_item.review_changed'
  | 'inventory_item.review_bulk_changed'
  | 'queue_items.excluded';

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceType = (typeof sourceTypeEnum.enumValues)[number];

export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type NewDiscoveryJob = typeof discoveryJobs.$inferInsert;
export type DiscoveryJobStatus =
  (typeof discoveryJobStatusEnum.enumValues)[number];

export type DiscoveryQueueItem = typeof discoveryQueueItems.$inferSelect;
export type NewDiscoveryQueueItem = typeof discoveryQueueItems.$inferInsert;
export type DiscoveryQueueItemStatus =
  (typeof discoveryQueueItemStatusEnum.enumValues)[number];

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryItemType =
  (typeof inventoryItemTypeEnum.enumValues)[number];

export type ExclusionRule = typeof exclusionRules.$inferSelect;
export type NewExclusionRule = typeof exclusionRules.$inferInsert;
export type ExclusionRuleScope =
  (typeof exclusionRuleScopeEnum.enumValues)[number];

export type ReviewDisposition =
  (typeof reviewDispositionEnum.enumValues)[number];

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const sourceSelectSchema = createSelectSchema(sources, {
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const discoveryJobSelectSchema = createSelectSchema(discoveryJobs, {
  createdAt: dateTime,
  startedAt: dateTime,
  finishedAt: dateTime,
  updatedAt: dateTime,
});

export const discoveryQueueItemSelectSchema = createSelectSchema(
  discoveryQueueItems,
  {
    availableAt: dateTime,
    leaseExpiresAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
    completedAt: dateTime,
  },
);

export const exclusionRuleSelectSchema = createSelectSchema(exclusionRules, {
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const auditEventSelectSchema = createSelectSchema(auditEvents, {
  createdAt: dateTime,
});

export const inventoryItemSelectSchema = createSelectSchema(inventoryItems, {
  modifiedAt: dateTime,
  reviewedAt: dateTime,
  firstSeenAt: dateTime,
  lastSeenAt: dateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});
