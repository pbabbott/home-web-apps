import { sql } from 'drizzle-orm';
import {
  boolean,
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

export const inventoryItemKindEnum = pgEnum('inventory_item_kind', [
  'file',
  'directory',
]);

export const exclusionRuleScopeEnum = pgEnum('exclusion_rule_scope', [
  'selective_only',
  'exclude_subtree',
]);

export const inventoryItemRecommendationEnum = pgEnum(
  'inventory_item_recommendation',
  ['back_up', 'skip', 'needs_review'],
);

/**
 * How sure the agent is. Not a calibrated probability: `high` = direct
 * evidence settles it, `medium` = strong signals with minor unknowns,
 * `low` = a guess (so the recommendation must be `needs_review`).
 */
export const inventoryItemConfidenceEnum = pgEnum('inventory_item_confidence', [
  'low',
  'medium',
  'high',
]);

export const inventoryItemDecisionEnum = pgEnum('inventory_item_decision', [
  'pending',
  'approved',
  'rejected',
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

export const sourceConnectionTypeEnum = pgEnum('source_connection_type', [
  'smb',
]);

/** Connection options that are not secret; the shape depends on the type. */
export type SourceConnectionSettings = {
  /**
   * SMB only: which share serves a Windows path prefix, for machines where
   * the admin shares (`C$`) are unavailable. The longest matching prefix wins.
   */
  shareMappings?: { pathPrefix: string; share: string }[];
};

/**
 * How to authenticate to a source's filesystem so files can be previewed.
 * At most one per source. `secretCiphertext` is encrypted by the API and is
 * opaque here; it is never selected into API responses.
 */
export const sourceConnections = pgTable('source_connections', {
  sourceId: uuid('source_id')
    .primaryKey()
    .references(() => sources.id, { onDelete: 'cascade' }),
  connectionType: sourceConnectionTypeEnum('connection_type').notNull(),
  username: text('username').notNull(),
  domain: text('domain'),
  secretCiphertext: text('secret_ciphertext').notNull(),
  settings: jsonb('settings')
    .$type<SourceConnectionSettings>()
    .notNull()
    .default({}),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastTestOk: boolean('last_test_ok'),
  lastTestError: text('last_test_error'),
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

/**
 * A persistent rule that limits discovery. `sourceId` null means the rule is
 * global (applies to every source). `exclude_subtree` drops the path and
 * everything beneath it; `selective_only` only stops the path itself from
 * being a backup inventory item while its descendants are still explored. One rule
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
 * A human's "I agree with this skip". Kept apart from the queue item's `result`
 * (which stays as the agent wrote it) and keyed by source + path, so it holds
 * across later jobs that skip the same path. `pattern` is '' for a plain path
 * skip; for a pattern skip, `path` is the directory and `pattern` the name
 * pattern. `queueItemId` only records where it was acknowledged.
 */
export const skipAcknowledgements = pgTable(
  'skip_acknowledgements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    pattern: text('pattern').notNull().default(''),
    queueItemId: uuid('queue_item_id').references(
      () => discoveryQueueItems.id,
      { onDelete: 'set null' },
    ),
    acknowledgedBy: text('acknowledged_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('skip_acknowledgements_source_path_pattern_unique').on(
      table.sourceId,
      table.normalizedPath,
      table.pattern,
    ),
  ],
);

/**
 * A human's "I looked at what is on disk in this directory". The listing
 * itself is read live from the source and never stored, so this records only
 * that someone reviewed it. Keyed by source + the directory's path, so it
 * holds across later jobs that visit the same directory; `queueItemId` only
 * records where it was acknowledged. It does not go stale when the directory's
 * contents change: a human takes it back.
 */
export const onDiskReviews = pgTable(
  'on_disk_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    normalizedPath: text('normalized_path').notNull(),
    queueItemId: uuid('queue_item_id').references(
      () => discoveryQueueItems.id,
      { onDelete: 'set null' },
    ),
    reviewedBy: text('reviewed_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('on_disk_reviews_source_path_unique').on(
      table.sourceId,
      table.normalizedPath,
    ),
  ],
);

/**
 * A coherent, potentially valuable backup unit proposed by the agent for human
 * review: usually a directory (a project, a photo folder), occasionally a
 * standalone file. One inventory item covers its whole subtree, so a repository is
 * one inventory item and its contents get no inventory items of their own. Approving it
 * authorizes backup of that scope. Not a queue task. Identity is source + normalized
 * root path, so rediscovery updates the same row.
 *
 * Two owners, kept apart on purpose. The agent owns the recommendation
 * columns (`recommendation`, `confidence`, `recommendationReason`,
 * `evidence`, `summary`, ...). A human owns `decision`, `decisionNote`,
 * `decidedAt` and `decidedBy`. The agent upsert must never list the decision
 * columns in its `set`, or rediscovery would reset a human's decision.
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
    /** The most recent job that proposed (or re-proposed) this inventory item. */
    lastJobId: uuid('last_job_id').references(() => discoveryJobs.id, {
      onDelete: 'set null',
    }),
    /**
     * The queue item (directory) that last proposed or added this inventory
     * item; a later job overwrites it. Counted per queue item for the job page.
     */
    lastQueueItemId: uuid('last_queue_item_id').references(
      () => discoveryQueueItems.id,
      { onDelete: 'set null' },
    ),
    kind: inventoryItemKindEnum('kind').notNull(),
    rootPath: text('root_path').notNull(),
    normalizedRootPath: text('normalized_root_path').notNull(),
    displayName: text('display_name').notNull(),
    summary: text('summary').notNull(),
    recommendation: inventoryItemRecommendationEnum('recommendation').notNull(),
    confidence: inventoryItemConfidenceEnum('confidence').notNull(),
    recommendationReason: text('recommendation_reason').notNull(),
    evidence: jsonb('evidence').$type<InventoryItemEvidence>().notNull(),
    /** When the recommendation, confidence or reason last changed. */
    recommendedAt: timestamp('recommended_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    recommendedBy: text('recommended_by'),
    decision: inventoryItemDecisionEnum('decision')
      .notNull()
      .default('pending'),
    decisionNote: text('decision_note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: text('decided_by'),
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
      table.normalizedRootPath,
    ),
    index('inventory_items_decision_idx').on(table.sourceId, table.decision),
    index('inventory_items_recommendation_idx').on(
      table.sourceId,
      table.recommendation,
    ),
    index('inventory_items_last_job_idx').on(table.lastJobId),
    index('inventory_items_last_queue_item_idx').on(table.lastQueueItemId),
    check(
      'inventory_items_decided_check',
      sql`${table.decision} = 'pending' or ${table.decidedAt} is not null`,
    ),
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
    exclusionRuleId: uuid('exclusion_rule_id'),
    inventoryItemId: uuid('inventory_item_id'),
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
  ],
);

/**
 * Concise, grounded observations behind an inventory item's recommendation. Only
 * verified facts belong in `observations`; what is unknown goes in
 * `openQuestions`. `git` is null when the path was not checked as a
 * repository; inside it, a null flag means "not determined".
 */
export type InventoryItemContentKind =
  | 'source_code'
  | 'personal_documents'
  | 'media'
  | 'configuration'
  | 'application_data'
  | 'generated_artifacts'
  | 'installed_software'
  | 'installers'
  | 'archives'
  | 'other';

export type InventoryItemGitEvidence = {
  remoteUrl: string | null;
  remoteVisibility: 'public' | 'private' | 'none' | 'unknown';
  /** True only when status and upstream comparison actually ran. */
  localStateKnown: boolean;
  uncommittedChanges: boolean | null;
  untrackedFiles: boolean | null;
  unpushedCommits: boolean | null;
  ignoredFilesOfNote: boolean | null;
};

export type InventoryItemEvidence = {
  contentKinds: InventoryItemContentKind[];
  git: InventoryItemGitEvidence | null;
  reproducible: 'yes' | 'no' | 'unknown';
  sufficientInformation: boolean;
  observations: string[];
  openQuestions: string[];
  estimatedSizeBytes?: number;
  estimatedFileCount?: number;
};

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
  | 'source_connection.deleted';

export type SourceConnection = typeof sourceConnections.$inferSelect;
export type NewSourceConnection = typeof sourceConnections.$inferInsert;
export type SourceConnectionType =
  (typeof sourceConnectionTypeEnum.enumValues)[number];

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

export type InventoryItemKind =
  (typeof inventoryItemKindEnum.enumValues)[number];

export type ExclusionRule = typeof exclusionRules.$inferSelect;
export type NewExclusionRule = typeof exclusionRules.$inferInsert;
export type ExclusionRuleScope =
  (typeof exclusionRuleScopeEnum.enumValues)[number];

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryItemRecommendation =
  (typeof inventoryItemRecommendationEnum.enumValues)[number];
export type InventoryItemConfidence =
  (typeof inventoryItemConfidenceEnum.enumValues)[number];
export type InventoryItemDecision =
  (typeof inventoryItemDecisionEnum.enumValues)[number];

export type SkipAcknowledgement = typeof skipAcknowledgements.$inferSelect;
export type NewSkipAcknowledgement = typeof skipAcknowledgements.$inferInsert;
export type OnDiskReview = typeof onDiskReviews.$inferSelect;
export type NewOnDiskReview = typeof onDiskReviews.$inferInsert;

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const sourceSelectSchema = createSelectSchema(sources, {
  createdAt: dateTime,
  updatedAt: dateTime,
});

/** Omits `secretCiphertext`: the secret never leaves the database layer. */
export const sourceConnectionSelectSchema = createSelectSchema(
  sourceConnections,
  {
    lastTestedAt: dateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
).omit({ secretCiphertext: true });

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

export const skipAcknowledgementSelectSchema = createSelectSchema(
  skipAcknowledgements,
  { createdAt: dateTime },
);

export const onDiskReviewSelectSchema = createSelectSchema(onDiskReviews, {
  createdAt: dateTime,
});

export const inventoryItemSelectSchema = createSelectSchema(inventoryItems, {
  recommendedAt: dateTime,
  decidedAt: dateTime,
  firstSeenAt: dateTime,
  lastSeenAt: dateTime,
  createdAt: dateTime,
  updatedAt: dateTime,
});
