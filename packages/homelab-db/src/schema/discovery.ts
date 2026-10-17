import { sql } from 'drizzle-orm';
import {
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

export const backupSourceTypeEnum = pgEnum('backup_source_type', ['windows']);

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

/**
 * A machine/filesystem being inventoried for the exodus file migration.
 * hostId optionally ties it to a registered host (join on hosts.id for
 * name/IP); null for a machine that isn't registered. RESTRICT so deleting a
 * host can't silently wipe its discovery history.
 */
export const backupSources = pgTable('backup_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  hostId: uuid('host_id').references(() => hosts.id, { onDelete: 'restrict' }),
  sourceType: backupSourceTypeEnum('source_type').notNull().default('windows'),
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
      .references(() => backupSources.id, { onDelete: 'cascade' }),
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
 * A directory awaiting inspection. `path` keeps the display form (original
 * case); `normalizedPath` is the lowercased canonical form used for dedupe.
 * An item is leased to a worker while `in_progress`: `claimToken` identifies
 * the current claim and `leaseExpiresAt` lets abandoned work be reclaimed.
 */
export const discoveryQueueItems = pgTable(
  'discovery_queue_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => backupSources.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => discoveryJobs.id, {
      onDelete: 'set null',
    }),
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
    uniqueIndex('discovery_queue_items_source_path_unique').on(
      table.sourceId,
      table.normalizedPath,
    ),
    index('discovery_queue_items_claim_idx').on(
      table.sourceId,
      table.status,
      table.priority.desc(),
      table.availableAt,
    ),
  ],
);

export type BackupSource = typeof backupSources.$inferSelect;
export type NewBackupSource = typeof backupSources.$inferInsert;
export type BackupSourceType = (typeof backupSourceTypeEnum.enumValues)[number];

export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type NewDiscoveryJob = typeof discoveryJobs.$inferInsert;
export type DiscoveryJobStatus =
  (typeof discoveryJobStatusEnum.enumValues)[number];

export type DiscoveryQueueItem = typeof discoveryQueueItems.$inferSelect;
export type NewDiscoveryQueueItem = typeof discoveryQueueItems.$inferInsert;
export type DiscoveryQueueItemStatus =
  (typeof discoveryQueueItemStatusEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const backupSourceSelectSchema = createSelectSchema(backupSources, {
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
