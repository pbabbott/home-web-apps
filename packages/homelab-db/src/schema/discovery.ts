import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
 * index allows at most one active (pending/running) job per source: the
 * queue is source-wide, so two concurrent jobs would just fight over the
 * same rows.
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
 * the same row. Only filesystem facts are overwritten on rediscovery; any
 * review/copy state added later lives in other columns and is left alone.
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
    check(
      'inventory_items_size_check',
      sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`,
    ),
  ],
);

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

export const inventoryItemSelectSchema = createSelectSchema(inventoryItems, {
  modifiedAt: dateTime,
  firstSeenAt: dateTime,
  lastSeenAt: dateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});
