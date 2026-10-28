import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
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
import { inventoryItemKindEnum, inventoryItems, sources } from './discovery';

export const backupDestinationTypeEnum = pgEnum('backup_destination_type', [
  'nfs',
]);

export const backupDestinationHealthEnum = pgEnum('backup_destination_health', [
  'unknown',
  'ok',
  'unhealthy',
]);

export const backupJobStatusEnum = pgEnum('backup_job_status', [
  'planned',
  'running',
  'completed',
  'completed_with_issues',
  'failed',
  'cancelled',
]);

export const backupJobStalledReasonEnum = pgEnum('backup_job_stalled_reason', [
  'destination_unhealthy',
  'destination_disabled',
  'source_unreachable',
]);

export const backupJobItemStatusEnum = pgEnum('backup_job_item_status', [
  'queued',
  'in_progress',
  'verified',
  'failed',
  'blocked',
  'skipped',
  'excluded',
]);

export const backupEntryTypeEnum = pgEnum('backup_entry_type', [
  'file',
  'directory',
]);

export const backupEntryStatusEnum = pgEnum('backup_entry_status', [
  'pending',
  'verified',
  'failed',
  'not_followed',
]);

export const backupEntryIssueKindEnum = pgEnum('backup_entry_issue_kind', [
  'read_failed',
  'unlistable',
  'source_missing',
  'name_too_long',
  'unsupported_path',
  'verify_mismatch',
  'write_failed',
  'dest_conflict',
  'reparse_point_not_followed',
  'kept_both',
]);

/** The expected identity of an NFS mount; where it is mounted is the worker's environment. */
export type BackupDestinationSettings = {
  server: string;
  exportPath: string;
};

/** What the worker's validation probe found; free-form because probes grow. */
export type BackupDestinationValidation = {
  ok: boolean;
  mountVerified?: boolean;
  checks?: { name: string; ok: boolean; message?: string }[];
  findings?: Record<string, unknown>;
};

/** Why part of a directory item is not copied. */
export type BackupCarveOut = {
  path: string;
  reason: 'rejected_item' | 'exclusion_rule';
  refId: string;
};

/** The request as made when the job was created. */
export type BackupJobSelection = {
  inventoryItemIds?: string[];
  pathPrefix?: string;
  kinds?: ('file' | 'directory')[];
  skipAlreadyCovered?: boolean;
};

/**
 * An NFS export Exodus writes to. `settings` is the expected identity of the
 * mount, `rootDir` an optional folder under it. The worker owns `health`,
 * `lastValidation` and `workerSeenAt`.
 */
export const backupDestinations = pgTable(
  'backup_destinations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    connectionType: backupDestinationTypeEnum('connection_type').notNull(),
    settings: jsonb('settings').$type<BackupDestinationSettings>().notNull(),
    rootDir: text('root_dir'),
    enabled: boolean('enabled').notNull().default(true),
    health: backupDestinationHealthEnum('health').notNull().default('unknown'),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    lastValidation:
      jsonb('last_validation').$type<BackupDestinationValidation>(),
    validationRequestedAt: timestamp('validation_requested_at', {
      withTimezone: true,
    }),
    workerSeenAt: timestamp('worker_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'backup_destinations_root_dir_check',
      sql`${table.rootDir} is null or (${table.rootDir} !~ '^[/\\\\]' and ${table.rootDir} !~ '(^|[/\\\\])\\.\\.([/\\\\]|$)')`,
    ),
  ],
);

/**
 * One attempt to copy a frozen selection of inventory items from a source to
 * a destination. Items are inserted with the job and never added later. At
 * most one active (planned/running) job per source and destination. Counts
 * are derived from items and entries.
 */
export const backupJobs = pgTable(
  'backup_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    destinationId: uuid('destination_id')
      .notNull()
      .references(() => backupDestinations.id, { onDelete: 'restrict' }),
    status: backupJobStatusEnum('status').notNull().default('planned'),
    /** Set by the worker while claims are paused; the job stays `running`. */
    stalledReason: backupJobStalledReasonEnum('stalled_reason'),
    stalledSince: timestamp('stalled_since', { withTimezone: true }),
    selection: jsonb('selection').$type<BackupJobSelection>().notNull(),
    /** Destination folder for this source, frozen at creation. */
    sourceDirName: text('source_dir_name').notNull(),
    error: text('error'),
    createdBy: text('created_by'),
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
    uniqueIndex('backup_jobs_one_active_per_source_destination')
      .on(table.sourceId, table.destinationId)
      .where(sql`${table.status} in ('planned', 'running')`),
    index('backup_jobs_destination_idx').on(
      table.destinationId,
      table.status,
      table.createdAt,
    ),
    check(
      'backup_jobs_stalled_check',
      sql`(${table.stalledReason} is null) = (${table.stalledSince} is null)`,
    ),
    check(
      'backup_jobs_finished_check',
      sql`${table.status} in ('planned', 'running') or ${table.finishedAt} is not null`,
    ),
  ],
);

/**
 * One inventory item inside a job: the snapshot, the leased unit of work and
 * the result. `rootPath` keeps the display form next to `normalizedRootPath`.
 */
export const backupJobItems = pgTable(
  'backup_job_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => backupJobs.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id').references(
      () => inventoryItems.id,
      { onDelete: 'set null' },
    ),
    kind: inventoryItemKindEnum('kind').notNull(),
    rootPath: text('root_path').notNull(),
    normalizedRootPath: text('normalized_root_path').notNull(),
    destRelPath: text('dest_rel_path').notNull(),
    carveOuts: jsonb('carve_outs')
      .$type<BackupCarveOut[]>()
      .notNull()
      .default([]),
    /** For a redundant nested item: the item whose copy contains it. */
    coveredByJobItemId: uuid('covered_by_job_item_id'),
    estimatedSizeBytes: bigint('estimated_size_bytes', { mode: 'number' }),
    status: backupJobItemStatusEnum('status').notNull().default('queued'),
    statusReason: text('status_reason'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull(),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedBy: text('claimed_by'),
    /** Who held the most recent claim; survives release, expiry and failure. */
    lastClaimedBy: text('last_claimed_by'),
    claimToken: uuid('claim_token'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    enumerationComplete: boolean('enumeration_complete')
      .notNull()
      .default(false),
    enumeratedAt: timestamp('enumerated_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('backup_job_items_job_inventory_unique').on(
      table.jobId,
      table.inventoryItemId,
    ),
    foreignKey({
      name: 'backup_job_items_covered_by_fk',
      columns: [table.coveredByJobItemId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    index('backup_job_items_claim_idx').on(
      table.jobId,
      table.status,
      table.availableAt,
    ),
    index('backup_job_items_inventory_idx').on(
      table.inventoryItemId,
      table.status,
    ),
    check(
      'backup_job_items_attempts_check',
      sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= ${table.maxAttempts} and ${table.maxAttempts} > 0`,
    ),
    check(
      'backup_job_items_lease_check',
      sql`${table.status} <> 'in_progress' or (${table.claimedBy} is not null and ${table.claimToken} is not null and ${table.leaseExpiresAt} is not null)`,
    ),
    check(
      'backup_job_items_verified_check',
      sql`${table.status} <> 'verified' or (${table.completedAt} is not null and ${table.enumerationComplete})`,
    ),
  ],
);

/**
 * One file or directory a job item covers: the manifest, the resume state and
 * the store for source metadata (which lives in no file on the destination).
 */
export const backupEntries = pgTable(
  'backup_entries',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    jobItemId: uuid('job_item_id')
      .notNull()
      .references(() => backupJobItems.id, { onDelete: 'cascade' }),
    /** Relative to the item root; empty for the root itself. */
    relPath: text('rel_path').notNull(),
    normalizedRelPath: text('normalized_rel_path').notNull(),
    entryType: backupEntryTypeEnum('entry_type').notNull(),
    status: backupEntryStatusEnum('status').notNull().default('pending'),
    issueKind: backupEntryIssueKindEnum('issue_kind'),
    message: text('message'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    sha256: text('sha256'),
    /** The path actually written, including any keep-both suffix. */
    destRelPath: text('dest_rel_path'),
    srcCreatedAt: timestamp('src_created_at', { withTimezone: true }),
    srcModifiedAt: timestamp('src_modified_at', { withTimezone: true }),
    srcAccessedAt: timestamp('src_accessed_at', { withTimezone: true }),
    srcChangedAt: timestamp('src_changed_at', { withTimezone: true }),
    srcAttributes: text('src_attributes'),
    srcStreams: jsonb('src_streams').$type<{ name: string; size: number }[]>(),
    srcZoneIdentifier: text('src_zone_identifier'),
    attempt: integer('attempt').notNull().default(0),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('backup_entries_item_path_unique').on(
      table.jobItemId,
      table.normalizedRelPath,
    ),
    index('backup_entries_item_status_idx').on(table.jobItemId, table.status),
    check(
      'backup_entries_verified_check',
      sql`${table.status} <> 'verified' or (${table.verifiedAt} is not null and (${table.entryType} <> 'file' or (${table.sha256} is not null and ${table.destRelPath} is not null)))`,
    ),
    check(
      'backup_entries_failed_check',
      sql`${table.status} <> 'failed' or ${table.issueKind} is not null`,
    ),
  ],
);

export type BackupDestination = typeof backupDestinations.$inferSelect;
export type NewBackupDestination = typeof backupDestinations.$inferInsert;
export type BackupDestinationType =
  (typeof backupDestinationTypeEnum.enumValues)[number];
export type BackupDestinationHealth =
  (typeof backupDestinationHealthEnum.enumValues)[number];

export type BackupJob = typeof backupJobs.$inferSelect;
export type NewBackupJob = typeof backupJobs.$inferInsert;
export type BackupJobStatus = (typeof backupJobStatusEnum.enumValues)[number];
export type BackupJobStalledReason =
  (typeof backupJobStalledReasonEnum.enumValues)[number];

export type BackupJobItem = typeof backupJobItems.$inferSelect;
export type NewBackupJobItem = typeof backupJobItems.$inferInsert;
export type BackupJobItemStatus =
  (typeof backupJobItemStatusEnum.enumValues)[number];

export type BackupEntry = typeof backupEntries.$inferSelect;
export type NewBackupEntry = typeof backupEntries.$inferInsert;
export type BackupEntryType = (typeof backupEntryTypeEnum.enumValues)[number];
export type BackupEntryStatus =
  (typeof backupEntryStatusEnum.enumValues)[number];
export type BackupEntryIssueKind =
  (typeof backupEntryIssueKindEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const backupDestinationSelectSchema = createSelectSchema(
  backupDestinations,
  {
    lastValidatedAt: dateTime,
    validationRequestedAt: dateTime,
    workerSeenAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
);

export const backupJobSelectSchema = createSelectSchema(backupJobs, {
  stalledSince: dateTime,
  createdAt: dateTime,
  startedAt: dateTime,
  finishedAt: dateTime,
  updatedAt: dateTime,
});

export const backupJobItemSelectSchema = createSelectSchema(backupJobItems, {
  availableAt: dateTime,
  leaseExpiresAt: dateTime,
  enumeratedAt: dateTime,
  startedAt: dateTime,
  completedAt: dateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const backupEntrySelectSchema = createSelectSchema(backupEntries, {
  srcCreatedAt: dateTime,
  srcModifiedAt: dateTime,
  srcAccessedAt: dateTime,
  srcChangedAt: dateTime,
  verifiedAt: dateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});
