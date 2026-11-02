import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { dateTime } from './shared';
import { discoveryJobStatusEnum, discoveryQueueItemStatusEnum } from './enums';
import { sources } from './sources';

/**
 * One discovery run over a source, rooted at `rootPath`. The partial unique
 * index allows at most one active (pending/running) job per source: two
 * concurrent walks of the same source would only duplicate work and fight
 * over the same inventory items.
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
    /** Why this directory was queued, for the next (memoryless) session. */
    reason: text('reason'),
    /** What the worker concluded about this directory (see QueueItemResult). */
    result: jsonb('result').$type<QueueItemResult>(),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedBy: text('claimed_by'),
    /** Who held the most recent claim; survives release, expiry and failure. */
    lastClaimedBy: text('last_claimed_by'),
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

/** What a worker concluded about a queue item's directory. */
export type QueueItemResult = {
  summary?: string;
  /** Paths seen but deliberately not explored or queued. */
  skipped: { path: string; reason: string }[];
  /**
   * Many similar direct entries of this directory skipped by name pattern
   * (`*.msi`) instead of one `skipped` entry each. Not recursive.
   */
  skippedGroups?: { pattern: string; count?: number; reason: string }[];
  /**
   * Child directories that could not be read (access denied). Each also exists
   * as a `failed` queue item a human can retry once access is granted.
   */
  unreadable?: { path: string; error: string }[];
};

export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type NewDiscoveryJob = typeof discoveryJobs.$inferInsert;
export type DiscoveryJobStatus =
  (typeof discoveryJobStatusEnum.enumValues)[number];

export type DiscoveryQueueItem = typeof discoveryQueueItems.$inferSelect;
export type NewDiscoveryQueueItem = typeof discoveryQueueItems.$inferInsert;
export type DiscoveryQueueItemStatus =
  (typeof discoveryQueueItemStatusEnum.enumValues)[number];

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
