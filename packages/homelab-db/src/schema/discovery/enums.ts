import { pgEnum } from 'drizzle-orm/pg-core';

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
