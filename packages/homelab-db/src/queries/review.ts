import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  inventoryItems,
  type InventoryItem,
  type ReviewDisposition,
} from '../schema/discovery';
import { insertAuditEvent, type Actor } from './audit';
import {
  listApplicableRules,
  resolveExclusion,
  rulesBySource,
  type ExclusionResolution,
} from './exclusion-rules';
import { DiscoveryError, type Tx } from './shared';

export const MAX_BULK_REVIEW_ITEMS = 200;

export type InventoryItemWithExclusion = InventoryItem & {
  exclusion: ExclusionResolution;
};

export const getInventoryItemById = async (
  db: Database,
  id: string,
): Promise<InventoryItemWithExclusion> => {
  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id));

  if (!item) throw new DiscoveryError('not_found', 'inventory item not found');

  const rules = await listApplicableRules(db, [item.sourceId]);

  return {
    ...item,
    exclusion: resolveExclusion(
      rulesBySource(rules, item.sourceId),
      item.normalizedPath,
    ),
  };
};

export type ReviewInput = {
  disposition: ReviewDisposition;
  /**
   * Replaces the note. When omitted the note is kept if the disposition is
   * unchanged and cleared if it changes (the old note explained the old
   * decision).
   */
  note?: string | null;
  actor: Actor;
};

/** An item changed by a review iff its disposition differs or a given note does. */
const isChange = (item: InventoryItem, input: ReviewInput): boolean =>
  item.reviewDisposition !== input.disposition ||
  (input.note !== undefined && input.note !== item.reviewNote);

/**
 * Candidates must be eligible: an item under an `exclude_subtree` rule, or
 * matched exactly by a `selective_only` rule, cannot be marked `candidate`.
 * Other dispositions are always allowed, so a human can still reject it.
 */
const assertEligible = async (
  tx: Tx,
  items: InventoryItem[],
  input: ReviewInput,
): Promise<void> => {
  if (input.disposition !== 'candidate') return;

  const rules = await listApplicableRules(
    tx,
    items.map((i) => i.sourceId),
  );
  const blocked = items.flatMap((item) => {
    const { state, ruleIds } = resolveExclusion(
      rulesBySource(rules, item.sourceId),
      item.normalizedPath,
    );

    return state === 'none' ? [] : [{ id: item.id, state, ruleIds }];
  });

  if (blocked.length > 0) {
    throw new DiscoveryError(
      'conflict',
      'excluded items cannot be marked as candidates',
      { blocked },
    );
  }
};

/** Writes the review columns for items that changed; returns their new rows. */
const applyReview = async (
  tx: Tx,
  changedIds: string[],
  input: ReviewInput,
): Promise<InventoryItem[]> => {
  if (changedIds.length === 0) return [];

  const t = inventoryItems;

  return tx
    .update(t)
    .set({
      reviewNote:
        input.note !== undefined
          ? input.note
          : sql`case when ${t.reviewDisposition} <> ${input.disposition}::review_disposition then null else ${t.reviewNote} end`,
      reviewDisposition: input.disposition,
      reviewedAt: sql`now()`,
      reviewedBy: input.actor.id ?? null,
      // Deliberately not bumping lastSeenAt: that is a filesystem fact.
      updatedAt: sql`now()`,
    })
    .where(inArray(t.id, changedIds))
    .returning();
};

/**
 * Records a human's decision about one item. Touches nothing but the review
 * columns — never queue state or filesystem facts — and writes its audit
 * event in the same transaction. A repeat of the current decision is a no-op
 * and writes no event.
 */
export const reviewInventoryItem = async (
  db: Database,
  id: string,
  input: ReviewInput,
): Promise<InventoryItem> =>
  db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .for('update');

    if (!item)
      throw new DiscoveryError('not_found', 'inventory item not found');

    await assertEligible(tx, [item], input);

    if (!isChange(item, input)) return item;

    const [updated] = await applyReview(tx, [item.id], input);

    await insertAuditEvent(tx, {
      eventType: 'inventory_item.review_changed',
      actor: input.actor,
      sourceId: item.sourceId,
      inventoryItemId: item.id,
      details: {
        path: item.path,
        from: item.reviewDisposition,
        to: updated.reviewDisposition,
        note: updated.reviewNote,
      },
    });

    return updated;
  });

export type BulkReviewInput = ReviewInput & { ids: string[] };

export type BulkReviewResult = {
  changedCount: number;
  unchangedCount: number;
  items: InventoryItem[];
};

/**
 * Applies one decision to up to MAX_BULK_REVIEW_ITEMS items, all or nothing:
 * a missing id or an ineligible candidate fails the whole request and
 * changes nothing. One audit event lists the changed item ids with their
 * prior dispositions, which keeps the payload bounded by the id cap.
 */
export const reviewInventoryItems = async (
  db: Database,
  input: BulkReviewInput,
): Promise<BulkReviewResult> =>
  db.transaction(async (tx) => {
    const ids = [...new Set(input.ids)];
    const t = inventoryItems;

    // Ordered lock acquisition, so overlapping batches cannot deadlock.
    const items = await tx
      .select()
      .from(t)
      .where(inArray(t.id, ids))
      .orderBy(t.id)
      .for('update');

    if (items.length !== ids.length) {
      const found = new Set(items.map((i) => i.id));

      throw new DiscoveryError('not_found', 'inventory items not found', {
        missingIds: ids.filter((id) => !found.has(id)),
      });
    }

    await assertEligible(tx, items, input);

    const changed = items.filter((i) => isChange(i, input));
    const updated = await applyReview(
      tx,
      changed.map((i) => i.id),
      input,
    );

    if (changed.length > 0) {
      const sourceIds = new Set(items.map((i) => i.sourceId));

      await insertAuditEvent(tx, {
        eventType: 'inventory_item.review_bulk_changed',
        actor: input.actor,
        sourceId: sourceIds.size === 1 ? items[0].sourceId : null,
        details: {
          disposition: input.disposition,
          note: input.note ?? null,
          requestedCount: ids.length,
          unchangedCount: items.length - changed.length,
          changed: changed.map((i) => ({
            id: i.id,
            from: i.reviewDisposition,
          })),
        },
      });
    }

    const updatedById = new Map(updated.map((i) => [i.id, i]));

    return {
      changedCount: changed.length,
      unchangedCount: items.length - changed.length,
      items: items.map((i) => updatedById.get(i.id) ?? i),
    };
  });
