import { sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  auditEvents,
  discoveryJobs,
  discoveryQueueItems,
  exclusionRules,
  inventoryItems,
  skipAcknowledgements,
  sources,
  type AuditEvent,
  type DiscoveryJob,
  type DiscoveryQueueItem,
  type ExclusionRule,
  type InventoryItem,
  type NewSource,
  type SkipAcknowledgement,
  type Source,
} from '../../schema/discovery';

// ~25 columns per inventory row keeps a chunk well under Postgres' 65535
// bind-parameter limit.
const IMPORT_CHUNK_SIZE = 500;

const chunk = <T>(rows: T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + IMPORT_CHUNK_SIZE));
  }

  return chunks;
};

/**
 * Upserts sources by `name` (unique) and returns the local rows. The local
 * `id` may differ from the imported one when a source of that name already
 * exists, so callers must remap `sourceId` on dependent rows.
 */
export const importSources = async (
  db: Database,
  rows: Pick<NewSource, 'name' | 'hostId' | 'sourceType'>[],
): Promise<Source[]> => {
  if (rows.length === 0) return [];

  return db
    .insert(sources)
    .values(rows)
    .onConflictDoUpdate({
      target: sources.name,
      set: {
        hostId: sql`excluded.host_id`,
        sourceType: sql`excluded.source_type`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
};

/** Upserts jobs by `id`, preserving imported ids so child rows still line up. */
export const importDiscoveryJobs = async (
  db: Database,
  rows: DiscoveryJob[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(discoveryJobs)
      .values(batch)
      .onConflictDoUpdate({
        target: discoveryJobs.id,
        set: {
          sourceId: sql`excluded.source_id`,
          rootPath: sql`excluded.root_path`,
          normalizedRootPath: sql`excluded.normalized_root_path`,
          status: sql`excluded.status`,
          error: sql`excluded.error`,
          startedAt: sql`excluded.started_at`,
          finishedAt: sql`excluded.finished_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/** Upserts queue items by `id`; the job must already be imported. */
export const importQueueItems = async (
  db: Database,
  rows: DiscoveryQueueItem[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(discoveryQueueItems)
      .values(batch)
      .onConflictDoUpdate({
        target: discoveryQueueItems.id,
        set: {
          status: sql`excluded.status`,
          priority: sql`excluded.priority`,
          attemptCount: sql`excluded.attempt_count`,
          maxAttempts: sql`excluded.max_attempts`,
          lastError: sql`excluded.last_error`,
          reason: sql`excluded.reason`,
          result: sql`excluded.result`,
          availableAt: sql`excluded.available_at`,
          claimedBy: sql`excluded.claimed_by`,
          claimToken: sql`excluded.claim_token`,
          leaseExpiresAt: sql`excluded.lease_expires_at`,
          updatedAt: sql`excluded.updated_at`,
          completedAt: sql`excluded.completed_at`,
        },
      });
  }
};

/**
 * Upserts inventory by `(sourceId, normalizedRootPath)`; the referenced jobs
 * must already be imported. Overwrites the recommendation and the human
 * decision with the imported ones. Local `id`s are kept when the row exists.
 */
export const importInventoryItems = async (
  db: Database,
  rows: InventoryItem[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(inventoryItems)
      .values(batch)
      .onConflictDoUpdate({
        target: [inventoryItems.sourceId, inventoryItems.normalizedRootPath],
        set: {
          firstJobId: sql`excluded.first_job_id`,
          lastJobId: sql`excluded.last_job_id`,
          // A remote that predates the column sends none; keep the local link.
          lastQueueItemId: sql`coalesce(excluded.last_queue_item_id, ${inventoryItems.lastQueueItemId})`,
          kind: sql`excluded.kind`,
          rootPath: sql`excluded.root_path`,
          displayName: sql`excluded.display_name`,
          summary: sql`excluded.summary`,
          recommendation: sql`excluded.recommendation`,
          confidence: sql`excluded.confidence`,
          recommendationReason: sql`excluded.recommendation_reason`,
          evidence: sql`excluded.evidence`,
          recommendedAt: sql`excluded.recommended_at`,
          recommendedBy: sql`excluded.recommended_by`,
          decision: sql`excluded.decision`,
          decisionNote: sql`excluded.decision_note`,
          decidedAt: sql`excluded.decided_at`,
          decidedBy: sql`excluded.decided_by`,
          firstSeenAt: sql`excluded.first_seen_at`,
          lastSeenAt: sql`excluded.last_seen_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/**
 * Upserts rules by `(sourceId, normalizedPath)`; a null `sourceId` is a
 * global rule.
 */
export const importExclusionRules = async (
  db: Database,
  rows: ExclusionRule[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(exclusionRules)
      .values(batch)
      .onConflictDoUpdate({
        target: [exclusionRules.sourceId, exclusionRules.normalizedPath],
        set: {
          path: sql`excluded.path`,
          scope: sql`excluded.scope`,
          reason: sql`excluded.reason`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
};

/** Appends audit events by `id`; the log is append-only, so existing ones stay. */
export const importAuditEvents = async (
  db: Database,
  rows: AuditEvent[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db.insert(auditEvents).values(batch).onConflictDoNothing();
  }
};

/**
 * Upserts skip acknowledgements by `(sourceId, normalizedPath, pattern)`. The
 * source, and any `queueItemId` that is set, must already be imported.
 */
export const importSkipAcknowledgements = async (
  db: Database,
  rows: SkipAcknowledgement[],
): Promise<void> => {
  for (const batch of chunk(rows)) {
    await db
      .insert(skipAcknowledgements)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          skipAcknowledgements.sourceId,
          skipAcknowledgements.normalizedPath,
          skipAcknowledgements.pattern,
        ],
        set: {
          path: sql`excluded.path`,
          queueItemId: sql`excluded.queue_item_id`,
          acknowledgedBy: sql`excluded.acknowledged_by`,
        },
      });
  }
};
