import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { dateTime } from './shared';
import {
  inventoryItemKindEnum,
  exclusionRuleScopeEnum,
  inventoryItemRecommendationEnum,
  inventoryItemConfidenceEnum,
  inventoryItemDecisionEnum,
} from './enums';
import { sources } from './sources';
import { discoveryJobs, discoveryQueueItems } from './jobs';

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

export const exclusionRuleSelectSchema = createSelectSchema(exclusionRules, {
  createdAt: dateTime,
  updatedAt: dateTime,
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
