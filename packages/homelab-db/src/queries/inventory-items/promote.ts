import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  type InventoryItemKind,
  type InventoryItem,
} from '../../schema/discovery';
import { insertAuditEvent, type Actor } from '../audit';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
} from '../exclusion-rules';
import { DiscoveryError } from '../shared';
import { applyDecision, skipInventoriedInActiveJob } from './decisions';

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
        lastQueueItemId: queueItemId,
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
          lastQueueItemId: queueItemId,
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
