import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type InventoryItemConfidence,
  type InventoryItemEvidence,
  type InventoryItemRecommendation,
  type InventoryItemKind,
  type InventoryItem,
} from '../../schema/discovery';
import { insertAuditEvent } from '../audit';
import { activeClaim, claimMissError } from '../discovery/claims';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
} from '../exclusion-rules';
import { DiscoveryError } from '../shared';

export type InventoryItemInput = {
  kind: InventoryItemKind;
  rootPath: string;
  normalizedRootPath: string;
  displayName: string;
  summary: string;
  recommendation: InventoryItemRecommendation;
  confidence: InventoryItemConfidence;
  recommendationReason: string;
  evidence: InventoryItemEvidence;
};

export type UpsertInventoryItemsInput = {
  claimToken: string;
  inventoryItems: InventoryItemInput[];
};

export type UpsertedInventoryItem = {
  inventoryItem: InventoryItem;
  created: boolean;
  /** True when recommendation, confidence, reason or other agent fields changed. */
  changed: boolean;
};

/** JSON with sorted keys: jsonb does not preserve key order, so compare canonically. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );

const jsonEqual = (a: unknown, b: unknown): boolean =>
  canonical(a) === canonical(b);

/**
 * Records the agent's proposals made while inspecting a claimed directory.
 * Source and job come from the claim, never the request. Identity is source +
 * normalized root path, so rediscovery updates the same row.
 *
 * Only agent-owned columns are ever written. The decision columns
 * (`decision`, `decisionNote`, `decidedAt`, `decidedBy`) are deliberately
 * absent from every `set` below: rediscovery must not reset a human's
 * decision, and a recommendation is never an approval.
 *
 * An audit event is written only when an inventory item is created or its
 * recommendation/confidence changes; an identical re-proposal just refreshes
 * `lastJobId`/`lastSeenAt`. Any path under an exclusion rule (excluded
 * subtree, or exactly a `selective_only` path) rejects the whole batch.
 */
export const upsertInventoryItems = async (
  db: Database,
  queueItemId: string,
  input: UpsertInventoryItemsInput,
): Promise<UpsertedInventoryItem[]> =>
  db.transaction(async (tx) => {
    const [claimed] = await tx
      .select({
        jobId: discoveryQueueItems.jobId,
        sourceId: discoveryJobs.sourceId,
        claimedBy: discoveryQueueItems.claimedBy,
      })
      .from(discoveryQueueItems)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
      .where(activeClaim(queueItemId, input.claimToken));

    if (!claimed) throw await claimMissError(tx, queueItemId);

    // The claiming worker is the agent; it is recorded as `recommendedBy`.
    const workerId = claimed.claimedBy;

    // One statement cannot touch a row twice; the last occurrence wins.
    const byPath = new Map(
      input.inventoryItems.map((c) => [c.normalizedRootPath, c]),
    );
    // Ordered so overlapping batches lock rows in the same order.
    const ordered = [...byPath.values()].sort((a, b) =>
      a.normalizedRootPath < b.normalizedRootPath
        ? -1
        : a.normalizedRootPath > b.normalizedRootPath
          ? 1
          : 0,
    );
    if (ordered.length === 0) return [];

    const rules = rulesBySource(
      await listApplicableRules(tx, [claimed.sourceId]),
      claimed.sourceId,
    );
    const blocked = ordered.flatMap((c) => {
      const { state, ruleIds } = resolveExclusion(rules, c.normalizedRootPath);

      return state === 'none' ? [] : [{ path: c.rootPath, state, ruleIds }];
    });
    if (blocked.length > 0) {
      throw new DiscoveryError(
        'conflict',
        'paths covered by an exclusion rule cannot be inventory items',
        { blocked },
      );
    }

    const t = inventoryItems;
    const inserted = await tx
      .insert(t)
      .values(
        ordered.map((c) => ({
          sourceId: claimed.sourceId,
          firstJobId: claimed.jobId,
          lastJobId: claimed.jobId,
          lastQueueItemId: queueItemId,
          kind: c.kind,
          rootPath: c.rootPath,
          normalizedRootPath: c.normalizedRootPath,
          displayName: c.displayName,
          summary: c.summary,
          recommendation: c.recommendation,
          confidence: c.confidence,
          recommendationReason: c.recommendationReason,
          evidence: c.evidence,
          recommendedBy: workerId,
        })),
      )
      .onConflictDoNothing({ target: [t.sourceId, t.normalizedRootPath] })
      .returning();
    const createdIds = new Set(inserted.map((row) => row.id));

    for (const row of inserted) {
      await insertAuditEvent(tx, {
        eventType: 'inventory_item.created',
        actor: { type: 'openclaw', id: workerId },
        sourceId: row.sourceId,
        jobId: claimed.jobId,
        queueItemId,
        inventoryItemId: row.id,
        details: {
          path: row.rootPath,
          recommendation: row.recommendation,
          confidence: row.confidence,
        },
      });
    }

    const existing = await tx
      .select()
      .from(t)
      .where(
        and(
          eq(t.sourceId, claimed.sourceId),
          inArray(
            t.normalizedRootPath,
            ordered.map((c) => c.normalizedRootPath),
          ),
        ),
      )
      .orderBy(asc(t.normalizedRootPath))
      .for('update');
    const rowByPath = new Map(existing.map((r) => [r.normalizedRootPath, r]));

    const results: UpsertedInventoryItem[] = [];
    for (const c of ordered) {
      const row = rowByPath.get(c.normalizedRootPath) as InventoryItem;

      if (createdIds.has(row.id)) {
        results.push({ inventoryItem: row, created: true, changed: false });
        continue;
      }

      const verdictChanged =
        row.recommendation !== c.recommendation ||
        row.confidence !== c.confidence;
      const reasonChanged = row.recommendationReason !== c.recommendationReason;
      const otherChanged =
        row.kind !== c.kind ||
        row.displayName !== c.displayName ||
        row.summary !== c.summary ||
        !jsonEqual(row.evidence, c.evidence);
      const changed = verdictChanged || reasonChanged || otherChanged;

      const [updated] = await tx
        .update(t)
        .set({
          lastJobId: claimed.jobId,
          lastQueueItemId: queueItemId,
          lastSeenAt: sql`now()`,
          ...(changed
            ? {
                kind: c.kind,
                displayName: c.displayName,
                summary: c.summary,
                recommendation: c.recommendation,
                confidence: c.confidence,
                recommendationReason: c.recommendationReason,
                evidence: c.evidence,
                updatedAt: sql`now()`,
              }
            : {}),
          ...(verdictChanged || reasonChanged
            ? { recommendedAt: sql`now()`, recommendedBy: workerId }
            : {}),
        })
        .where(eq(t.id, row.id))
        .returning();

      if (verdictChanged) {
        await insertAuditEvent(tx, {
          eventType: 'inventory_item.recommendation_changed',
          actor: { type: 'openclaw', id: workerId },
          sourceId: row.sourceId,
          jobId: claimed.jobId,
          queueItemId,
          inventoryItemId: row.id,
          details: {
            path: row.rootPath,
            from: {
              recommendation: row.recommendation,
              confidence: row.confidence,
            },
            to: { recommendation: c.recommendation, confidence: c.confidence },
            reason: c.recommendationReason,
            decision: row.decision,
          },
        });
      }

      results.push({ inventoryItem: updated, created: false, changed });
    }

    return results;
  });
