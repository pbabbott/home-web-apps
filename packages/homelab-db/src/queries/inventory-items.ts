import { and, asc, count, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
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
import {
  ACTIVE_JOB_STATUSES,
  activeClaim,
  claimMissError,
} from './discovery/claims';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
  type ExclusionResolution,
} from './exclusion-rules';
import {
  DiscoveryError,
  MAX_AUDITED_ITEM_IDS,
  coversSql,
  escapeLike,
  type Tx,
} from './shared';

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
 * Writes a decision onto a locked inventory item row, with its audit event.
 * Returns the row unchanged (no event) when neither decision nor note differ.
 * Approval requires the path to be free of exclusion rules.
 */
const applyDecision = async (
  tx: Tx,
  before: InventoryItem,
  input: DecideInventoryItemInput,
): Promise<InventoryItem> => {
  const t = inventoryItems;

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
        {
          state,
          ruleIds,
        },
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
    .where(eq(t.id, before.id))
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
};

/**
 * Skips every still-queued item of the job that sits at or under an
 * approved directory inventory item: approving a directory covers its whole
 * subtree, so exploring inside it is wasted work. Called wherever work is
 * handed out or queued (like `skipExcludedQueueItems`), and right after a
 * human approves a directory, where `underPath` limits it to that directory. In-progress items are left to finish; completed and
 * failed items are untouched. Records one system audit event when anything was
 * skipped.
 */
export const skipInventoriedQueueItems = async (
  tx: Tx,
  input: {
    jobId: string;
    sourceId: string;
    /**
     * Only skip items at or beneath this normalized path. Set when a human just
     * approved that directory, so the action touches nothing else; unset at
     * claim and enqueue, where every approved directory is enforced.
     */
    underPath?: string;
  },
): Promise<number> => {
  const q = discoveryQueueItems;
  const i = inventoryItems;

  const skipped = await tx
    .update(q)
    .set({
      status: 'skipped',
      // Names the nearest (deepest) approved directory, so the reason is traceable.
      lastError: sql`'skipped: covered by approved inventory item ' || (select ${i.rootPath} from ${i} where ${i.sourceId} = ${input.sourceId} and ${i.kind} = 'directory' and ${i.decision} = 'approved' and ${coversSql(i.normalizedRootPath, q.normalizedPath)} order by length(${i.normalizedRootPath}) desc limit 1)`,
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(q.jobId, input.jobId),
        eq(q.status, 'queued'),
        input.underPath
          ? coversSql(input.underPath, q.normalizedPath)
          : undefined,
        sql`exists (select 1 from ${i} where ${i.sourceId} = ${input.sourceId} and ${i.kind} = 'directory' and ${i.decision} = 'approved' and ${coversSql(i.normalizedRootPath, q.normalizedPath)})`,
      ),
    )
    .returning({ id: q.id, normalizedPath: q.normalizedPath });

  if (skipped.length === 0) return 0;

  const paths = JSON.stringify(skipped.map((s) => s.normalizedPath));
  const covering = await tx
    .select({ id: i.id })
    .from(i)
    .where(
      and(
        eq(i.sourceId, input.sourceId),
        eq(i.kind, 'directory'),
        eq(i.decision, 'approved'),
        sql`exists (select 1 from jsonb_array_elements_text(${paths}::jsonb) as p(path) where ${coversSql(i.normalizedRootPath, sql`p.path`)})`,
      ),
    );

  await insertAuditEvent(tx, {
    eventType: 'queue_items.inventoried',
    actor: { type: 'system' },
    sourceId: input.sourceId,
    jobId: input.jobId,
    details: {
      count: skipped.length,
      inventoryItemIds: covering.map((row) => row.id),
      itemIds: skipped.slice(0, MAX_AUDITED_ITEM_IDS).map((s) => s.id),
      truncated: skipped.length > MAX_AUDITED_ITEM_IDS,
    },
  });

  return skipped.length;
};

/**
 * `skipInventoriedQueueItems` for the source's active job, if it has one (at
 * most one can). Run after a directory is approved so a running job's queue
 * reflects it at once rather than at the next claim.
 */
const skipInventoriedInActiveJob = async (
  tx: Tx,
  sourceId: string,
  underPath: string,
): Promise<number> => {
  const [job] = await tx
    .select({ id: discoveryJobs.id })
    .from(discoveryJobs)
    .where(
      and(
        eq(discoveryJobs.sourceId, sourceId),
        inArray(discoveryJobs.status, ACTIVE_JOB_STATUSES),
      ),
    );

  return job
    ? skipInventoriedQueueItems(tx, { jobId: job.id, sourceId, underPath })
    : 0;
};

/**
 * Records a human's decision. Only a human actor may decide: agent
 * recommendations never approve or reject. Approval requires the path to be
 * free of exclusion rules. Any explicit change is allowed (including
 * reversing or resetting to `pending`) and audited; repeating the current
 * decision and note is a no-op with no event. Touches only the decision
 * columns. Approving a directory skips the active job's queued items beneath
 * it; reversing the approval does not requeue them.
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
    const [before] = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .for('update');

    if (!before)
      throw new DiscoveryError('not_found', 'inventory item not found');

    const after = await applyDecision(tx, before, input);

    if (after.decision === 'approved' && after.kind === 'directory') {
      await skipInventoriedInActiveJob(
        tx,
        after.sourceId,
        after.normalizedRootPath,
      );
    }

    return after;
  });
};

export type PromoteInventoryItemInput = {
  kind: InventoryItemKind;
  rootPath: string;
  normalizedRootPath: string;
  displayName: string;
  /** Why the agent skipped it, kept in the recommendation reason and audit event. */
  skipReason?: string;
  note?: string | null;
  actor: Actor;
};

/**
 * Turns a path the agent skipped into an approved inventory item. Only a
 * human may do it: promoting is the human's approval. The queue item may be
 * in any status and no claim is needed. Never overwrites: a path that
 * already has an inventory item is refused (409 with `inventoryItemId`), so
 * an agent row or a human decision is never replaced. A path under an
 * exclusion rule is refused like any other proposal.
 */
export const promoteInventoryItem = async (
  db: Database,
  queueItemId: string,
  input: PromoteInventoryItemInput,
): Promise<InventoryItem> => {
  if (input.actor.type !== 'human') {
    throw new DiscoveryError(
      'conflict',
      'only a human can promote a skipped path to the inventory',
    );
  }

  return db.transaction(async (tx) => {
    const [queued] = await tx
      .select({
        jobId: discoveryQueueItems.jobId,
        sourceId: discoveryJobs.sourceId,
      })
      .from(discoveryQueueItems)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
      .where(eq(discoveryQueueItems.id, queueItemId));

    if (!queued) throw new DiscoveryError('not_found', 'queue item not found');

    const t = inventoryItems;
    const [existing] = await tx
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          eq(t.sourceId, queued.sourceId),
          eq(t.normalizedRootPath, input.normalizedRootPath),
        ),
      );

    if (existing) {
      throw new DiscoveryError(
        'conflict',
        'this path is already an inventory item',
        { inventoryItemId: existing.id },
      );
    }

    const rules = rulesBySource(
      await listApplicableRules(tx, [queued.sourceId]),
      queued.sourceId,
    );
    const { state, ruleIds } = resolveExclusion(
      rules,
      input.normalizedRootPath,
    );
    if (state !== 'none') {
      throw new DiscoveryError(
        'conflict',
        'paths covered by an exclusion rule cannot be inventory items',
        { blocked: [{ path: input.rootPath, state, ruleIds }] },
      );
    }

    const humanId = input.actor.id ?? 'human';
    const [row] = await tx
      .insert(t)
      .values({
        sourceId: queued.sourceId,
        firstJobId: queued.jobId,
        lastJobId: queued.jobId,
        kind: input.kind,
        rootPath: input.rootPath,
        normalizedRootPath: input.normalizedRootPath,
        displayName: input.displayName,
        summary: 'Promoted from a skipped path by a human.',
        recommendation: 'back_up',
        confidence: 'high',
        recommendationReason: input.skipReason
          ? `Promoted by a human; the agent skipped it: ${input.skipReason}`
          : 'Promoted by a human; the agent skipped it.',
        evidence: {
          contentKinds: ['other'],
          git: null,
          reproducible: 'unknown',
          sufficientInformation: false,
          observations: [],
          openQuestions: [],
        },
        recommendedBy: humanId,
        decision: 'approved',
        decisionNote: input.note ?? null,
        decidedAt: sql`now()`,
        decidedBy: humanId,
      })
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'inventory_item.promoted',
      actor: input.actor,
      sourceId: queued.sourceId,
      jobId: queued.jobId,
      queueItemId,
      inventoryItemId: row.id,
      details: {
        path: row.rootPath,
        kind: row.kind,
        skipReason: input.skipReason ?? null,
      },
    });

    if (row.kind === 'directory') {
      await skipInventoriedInActiveJob(
        tx,
        row.sourceId,
        row.normalizedRootPath,
      );
    }

    return row;
  });
};

export type InventoryQueueItemDirectoryInput = {
  /** Name for a new item; ignored when the agent already proposed the directory. */
  displayName: string;
  note?: string | null;
  actor: Actor;
};

export type InventoriedDirectory = {
  inventoryItem: InventoryItem;
  /** False when the agent had already proposed the directory. */
  created: boolean;
  /** Queued items of the active job skipped because they sit inside it. */
  skippedQueueItems: number;
};

/**
 * A human adds a queue item's whole directory to the inventory: approves the
 * agent's proposal for it when there is one (agent fields untouched, like
 * any decision), otherwise creates an approved directory item. Either way the
 * active job's queued items beneath it are skipped, so its subtree is not
 * explored. Human only; a path under an exclusion rule is refused.
 */
export const inventoryQueueItemDirectory = async (
  db: Database,
  queueItemId: string,
  input: InventoryQueueItemDirectoryInput,
): Promise<InventoriedDirectory> => {
  if (input.actor.type !== 'human') {
    throw new DiscoveryError(
      'conflict',
      'only a human can add a whole directory to the inventory',
    );
  }

  return db.transaction(async (tx) => {
    const [queued] = await tx
      .select({
        jobId: discoveryQueueItems.jobId,
        sourceId: discoveryJobs.sourceId,
        path: discoveryQueueItems.path,
        normalizedPath: discoveryQueueItems.normalizedPath,
      })
      .from(discoveryQueueItems)
      .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
      .where(eq(discoveryQueueItems.id, queueItemId));

    if (!queued) throw new DiscoveryError('not_found', 'queue item not found');

    const t = inventoryItems;
    const [existing] = await tx
      .select()
      .from(t)
      .where(
        and(
          eq(t.sourceId, queued.sourceId),
          eq(t.normalizedRootPath, queued.normalizedPath),
        ),
      )
      .for('update');

    if (existing && existing.kind !== 'directory') {
      throw new DiscoveryError(
        'conflict',
        'this path is already a file inventory item',
        { inventoryItemId: existing.id },
      );
    }

    const rules = rulesBySource(
      await listApplicableRules(tx, [queued.sourceId]),
      queued.sourceId,
    );
    const { state, ruleIds } = resolveExclusion(rules, queued.normalizedPath);
    if (state !== 'none') {
      throw new DiscoveryError(
        'conflict',
        'paths covered by an exclusion rule cannot be inventory items',
        { blocked: [{ path: queued.path, state, ruleIds }] },
      );
    }

    let inventoryItem: InventoryItem;
    if (existing) {
      inventoryItem = await applyDecision(tx, existing, {
        decision: 'approved',
        note: input.note,
        actor: input.actor,
      });
    } else {
      const humanId = input.actor.id ?? 'human';
      [inventoryItem] = await tx
        .insert(t)
        .values({
          sourceId: queued.sourceId,
          firstJobId: queued.jobId,
          lastJobId: queued.jobId,
          kind: 'directory',
          rootPath: queued.path,
          normalizedRootPath: queued.normalizedPath,
          displayName: input.displayName,
          summary: 'Added as a whole directory by a human.',
          recommendation: 'back_up',
          confidence: 'high',
          recommendationReason:
            'Added by a human to back up as a whole, without exploring inside it.',
          evidence: {
            contentKinds: ['other'],
            git: null,
            reproducible: 'unknown',
            sufficientInformation: false,
            observations: [],
            openQuestions: [],
          },
          recommendedBy: humanId,
          decision: 'approved',
          decisionNote: input.note ?? null,
          decidedAt: sql`now()`,
          decidedBy: humanId,
        })
        .returning();

      await insertAuditEvent(tx, {
        eventType: 'inventory_item.promoted',
        actor: input.actor,
        sourceId: queued.sourceId,
        jobId: queued.jobId,
        queueItemId,
        inventoryItemId: inventoryItem.id,
        details: {
          path: inventoryItem.rootPath,
          kind: inventoryItem.kind,
          skipReason: null,
          wholeDirectory: true,
        },
      });
    }

    return {
      inventoryItem,
      created: !existing,
      skippedQueueItems: await skipInventoriedInActiveJob(
        tx,
        queued.sourceId,
        queued.normalizedPath,
      ),
    };
  });
};

export type ListInventoryItemsOptions = {
  sourceId: string;
  /** Inventory items last proposed by this job. */
  jobId?: string;
  recommendation?: InventoryItemRecommendation;
  decision?: InventoryItemDecision;
  kind?: InventoryItemKind;
  /** The path (normalized) itself and everything beneath it. */
  normalizedPathPrefix?: string;
  /** Exactly this path (normalized), nothing beneath it. */
  normalizedPath?: string;
  /** Case-insensitive substring of the path, display name or summary. */
  search?: string;
  /** Keyset cursor: the last normalizedRootPath of the previous page. */
  after?: string;
  /** Rows to skip, for numbered pages. Not combined with `after`. */
  offset?: number;
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

const searchFilter = (search: string): SQL => {
  const t = inventoryItems;
  const pattern = `%${escapeLike(search)}%`;

  return sql`(${t.rootPath} ilike ${pattern} escape '!' or ${t.displayName} ilike ${pattern} escape '!' or ${t.summary} ilike ${pattern} escape '!')`;
};

/** The filters shared by a page of inventory items and its total. Paging is applied by the caller. */
const filterConditions = (
  options: ListInventoryItemsOptions,
  { cursor }: { cursor: boolean },
): (SQL | undefined)[] => {
  const t = inventoryItems;

  return [
    eq(t.sourceId, options.sourceId),
    options.jobId ? eq(t.lastJobId, options.jobId) : undefined,
    options.recommendation
      ? eq(t.recommendation, options.recommendation)
      : undefined,
    options.decision ? eq(t.decision, options.decision) : undefined,
    options.kind ? eq(t.kind, options.kind) : undefined,
    options.normalizedPathPrefix
      ? subtreeFilter(options.normalizedPathPrefix)
      : undefined,
    options.normalizedPath
      ? eq(t.normalizedRootPath, options.normalizedPath)
      : undefined,
    options.search ? searchFilter(options.search) : undefined,
    cursor && options.after
      ? gt(t.normalizedRootPath, options.after)
      : undefined,
  ];
};

export const listInventoryItems = async (
  db: Database | Tx,
  options: ListInventoryItemsOptions,
): Promise<InventoryItem[]> => {
  const t = inventoryItems;

  return db
    .select()
    .from(t)
    .where(and(...filterConditions(options, { cursor: true })))
    .orderBy(asc(t.normalizedRootPath))
    .limit(
      Math.min(
        options.limit ?? LIST_INVENTORY_ITEMS_DEFAULT_LIMIT,
        LIST_INVENTORY_ITEMS_MAX_LIMIT,
      ),
    )
    .offset(options.offset ?? 0);
};

/** How many inventory items match the filters, ignoring the paging options. */
export const countInventoryItems = async (
  db: Database | Tx,
  options: ListInventoryItemsOptions,
): Promise<number> => {
  const [row] = await db
    .select({ total: count() })
    .from(inventoryItems)
    .where(and(...filterConditions(options, { cursor: false })));

  return row.total;
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
