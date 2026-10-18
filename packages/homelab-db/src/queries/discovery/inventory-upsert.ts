import { sql, getTableColumns } from 'drizzle-orm';
import {
  inventoryItems,
  type InventoryItem,
  type InventoryItemType,
} from '../../schema/discovery';
import type { Tx } from '../shared';

export type InventoryPath = {
  itemType: InventoryItemType;
  path: string;
  normalizedPath: string;
  parentPath: string | null;
  normalizedParentPath: string | null;
  name: string;
  extension: string | null;
  sizeBytes?: number | null;
  modifiedAt?: Date | null;
};

/**
 * Upserts inventory rows by source + normalized path. Only filesystem facts
 * and `lastSeen*` are overwritten; id, first-seen data and the human review
 * columns (reviewDisposition, reviewedAt, reviewedBy, reviewNote) are
 * untouched — never add them to the `set` below, or rediscovery would reset
 * a human's decision. A missing size or mtime keeps the
 * stored value. Rows are written in normalized-path order so overlapping
 * batches from concurrent workers always lock rows in the same order and
 * cannot deadlock. Results come back in the order the paths were given.
 */
export const upsertInventoryItems = async (
  tx: Tx,
  input: { sourceId: string; jobId: string; items: InventoryPath[] },
): Promise<{ item: InventoryItem; created: boolean }[]> => {
  // One statement cannot update the same row twice; last occurrence wins.
  const byPath = new Map(input.items.map((i) => [i.normalizedPath, i]));
  if (byPath.size === 0) return [];

  const inputOrder = new Map([...byPath.keys()].map((p, idx) => [p, idx]));
  const lockOrder = [...byPath.values()].sort((a, b) =>
    a.normalizedPath < b.normalizedPath
      ? -1
      : a.normalizedPath > b.normalizedPath
        ? 1
        : 0,
  );

  const t = inventoryItems;
  const rows = await tx
    .insert(t)
    .values(
      lockOrder.map((i) => ({
        sourceId: input.sourceId,
        firstJobId: input.jobId,
        lastJobId: input.jobId,
        itemType: i.itemType,
        path: i.path,
        normalizedPath: i.normalizedPath,
        parentPath: i.parentPath,
        normalizedParentPath: i.normalizedParentPath,
        name: i.name,
        extension: i.extension,
        sizeBytes: i.sizeBytes ?? null,
        modifiedAt: i.modifiedAt ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [t.sourceId, t.normalizedPath],
      set: {
        lastJobId: input.jobId,
        itemType: sql`excluded.item_type`,
        path: sql`excluded.path`,
        parentPath: sql`excluded.parent_path`,
        normalizedParentPath: sql`excluded.normalized_parent_path`,
        name: sql`excluded.name`,
        extension: sql`excluded.extension`,
        sizeBytes: sql`coalesce(excluded.size_bytes, ${t.sizeBytes})`,
        modifiedAt: sql`coalesce(excluded.modified_at, ${t.modifiedAt})`,
        lastSeenAt: sql`now()`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ ...getTableColumns(t), created: sql<boolean>`(xmax = 0)` });

  return rows
    .sort(
      (a, b) =>
        (inputOrder.get(a.normalizedPath) ?? 0) -
        (inputOrder.get(b.normalizedPath) ?? 0),
    )
    .map(({ created, ...item }) => ({ item, created }));
};
