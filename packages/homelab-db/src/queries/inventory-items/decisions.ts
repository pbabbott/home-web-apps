import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type InventoryItemDecision,
  type InventoryItem,
} from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import { ACTIVE_JOB_STATUSES } from '../discovery/claims';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
  type ExclusionResolution,
} from '../exclusion-rules';
import {
  DiscoveryError,
  MAX_AUDITED_ITEM_IDS,
  coversSql,
  type Tx,
} from '../shared';

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
export const applyDecision = async (
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
export const skipInventoriedInActiveJob = async (
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
