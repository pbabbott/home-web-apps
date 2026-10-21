import { and, asc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type InventoryItemConfidence,
  type InventoryItemDecision,
  type InventoryItemEvidence,
  type InventoryItemRecommendation,
  type InventoryItemKind,
  type InventoryItem,
} from '../schema/discovery';
import { insertAuditEvent, type Actor } from './audit';
import { activeClaim, claimMissError } from './discovery/claims';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
  type ExclusionResolution,
} from './exclusion-rules';
import { DiscoveryError, escapeLike, type Tx } from './shared';

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

export type InventoryItemWithExclusion = InventoryItem & {
  exclusion: ExclusionResolution;
};

export const getInventoryItemById = async (
  db: Database,
  id: string,
): Promise<InventoryItemWithExclusion> => {
  const [inventoryItem] = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id));

  if (!inventoryItem)
    throw new DiscoveryError('not_found', 'inventory item not found');

  const rules = await listApplicableRules(db, [inventoryItem.sourceId]);

  return {
    ...inventoryItem,
    exclusion: resolveExclusion(
      rulesBySource(rules, inventoryItem.sourceId),
      inventoryItem.normalizedRootPath,
    ),
  };
};

export type DecideInventoryItemInput = {
  decision: InventoryItemDecision;
  /**
   * Replaces the note. When omitted the note is kept if the decision is
   * unchanged and cleared if it changes (the old note explained the old
   * decision).
   */
  note?: string | null;
  actor: Actor;
};

/**
 * Records a human's decision. Only a human actor may decide: agent
 * recommendations never approve or reject. Approval requires the path to be
 * free of exclusion rules. Any explicit change is allowed (including
 * reversing or resetting to `pending`) and audited; repeating the current
 * decision and note is a no-op with no event. Touches only the decision
 * columns.
 */
export const decideInventoryItem = async (
  db: Database,
  id: string,
  input: DecideInventoryItemInput,
): Promise<InventoryItem> => {
  if (input.actor.type !== 'human') {
    throw new DiscoveryError(
      'conflict',
      'only a human can approve or reject an inventory item',
    );
  }

  return db.transaction(async (tx) => {
    const t = inventoryItems;
    const [before] = await tx
      .select()
      .from(t)
      .where(eq(t.id, id))
      .for('update');

    if (!before)
      throw new DiscoveryError('not_found', 'inventory item not found');

    if (input.decision === 'approved') {
      const rules = rulesBySource(
        await listApplicableRules(tx, [before.sourceId]),
        before.sourceId,
      );
      const { state, ruleIds } = resolveExclusion(
        rules,
        before.normalizedRootPath,
      );

      if (state !== 'none') {
        throw new DiscoveryError(
          'conflict',
          'excluded paths cannot be approved',
          { state, ruleIds },
        );
      }
    }

    const decisionChanged = before.decision !== input.decision;
    const note =
      input.note !== undefined
        ? input.note
        : decisionChanged
          ? null
          : before.decisionNote;

    if (!decisionChanged && note === before.decisionNote) return before;

    const pending = input.decision === 'pending';
    const [after] = await tx
      .update(t)
      .set({
        decision: input.decision,
        decisionNote: note,
        decidedAt: pending ? null : sql`now()`,
        decidedBy: pending ? null : (input.actor.id ?? 'human'),
        updatedAt: sql`now()`,
      })
      .where(eq(t.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'inventory_item.decision_changed',
      actor: input.actor,
      sourceId: before.sourceId,
      inventoryItemId: before.id,
      details: {
        path: before.rootPath,
        from: before.decision,
        to: after.decision,
        note: after.decisionNote,
        recommendation: before.recommendation,
      },
    });

    return after;
  });
};

export type ListInventoryItemsOptions = {
  sourceId: string;
  /** Inventory items last proposed by this job. */
  jobId?: string;
  recommendation?: InventoryItemRecommendation;
  decision?: InventoryItemDecision;
  /** The path (normalized) itself and everything beneath it. */
  normalizedPathPrefix?: string;
  /** Keyset cursor: the last normalizedRootPath of the previous page. */
  after?: string;
  limit?: number;
};

const LIST_INVENTORY_ITEMS_DEFAULT_LIMIT = 100;
const LIST_INVENTORY_ITEMS_MAX_LIMIT = 500;

const subtreeFilter = (normalizedDir: string): SQL => {
  const t = inventoryItems;
  const dir = normalizedDir.endsWith('\\')
    ? normalizedDir.slice(0, -1)
    : normalizedDir;

  return sql`(${t.normalizedRootPath} = ${normalizedDir} or ${t.normalizedRootPath} like ${`${escapeLike(dir)}\\%`} escape '!')`;
};

export const listInventoryItems = async (
  db: Database | Tx,
  options: ListInventoryItemsOptions,
): Promise<InventoryItem[]> => {
  const t = inventoryItems;

  return db
    .select()
    .from(t)
    .where(
      and(
        eq(t.sourceId, options.sourceId),
        options.jobId ? eq(t.lastJobId, options.jobId) : undefined,
        options.recommendation
          ? eq(t.recommendation, options.recommendation)
          : undefined,
        options.decision ? eq(t.decision, options.decision) : undefined,
        options.normalizedPathPrefix
          ? subtreeFilter(options.normalizedPathPrefix)
          : undefined,
        options.after ? gt(t.normalizedRootPath, options.after) : undefined,
      ),
    )
    .orderBy(asc(t.normalizedRootPath))
    .limit(
      Math.min(
        options.limit ?? LIST_INVENTORY_ITEMS_DEFAULT_LIMIT,
        LIST_INVENTORY_ITEMS_MAX_LIMIT,
      ),
    );
};

/** The part of a nearby inventory item worth showing next to a proposal. */
export type NestedInventoryItem = Pick<
  InventoryItem,
  'id' | 'kind' | 'rootPath' | 'displayName' | 'recommendation' | 'decision'
>;

const NESTED_COVERS_LIMIT = 50;

const nestedColumns = {
  id: inventoryItems.id,
  kind: inventoryItems.kind,
  rootPath: inventoryItems.rootPath,
  displayName: inventoryItems.displayName,
  recommendation: inventoryItems.recommendation,
  decision: inventoryItems.decision,
};

/**
 * Other inventory items of the source that overlap a path: `coveredBy` are those
 * whose root is a proper ancestor (`ancestorPaths` are the normalized
 * ancestors of the path), `covers` those beneath it (capped, ordered by path).
 * Informational only: nesting is allowed and nothing is inherited.
 */
export const findNestedInventoryItems = async (
  db: Database | Tx,
  sourceId: string,
  normalizedPath: string,
  ancestorPaths: string[],
): Promise<{
  coveredBy: NestedInventoryItem[];
  covers: NestedInventoryItem[];
}> => {
  const t = inventoryItems;

  const coveredBy = ancestorPaths.length
    ? await db
        .select(nestedColumns)
        .from(t)
        .where(
          and(
            eq(t.sourceId, sourceId),
            inArray(t.normalizedRootPath, ancestorPaths),
          ),
        )
        .orderBy(asc(t.normalizedRootPath))
    : [];

  const covers = await db
    .select(nestedColumns)
    .from(t)
    .where(
      and(
        eq(t.sourceId, sourceId),
        subtreeFilter(normalizedPath),
        sql`${t.normalizedRootPath} <> ${normalizedPath}`,
      ),
    )
    .orderBy(asc(t.normalizedRootPath))
    .limit(NESTED_COVERS_LIMIT);

  return { coveredBy, covers };
};
