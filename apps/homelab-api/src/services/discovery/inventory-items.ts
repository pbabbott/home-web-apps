import {
  DiscoveryError,
  decideInventoryItem as decideInventoryItemRow,
  findNestedInventoryItems,
  getQueueItemById,
  getInventoryItemById,
  getSourceById,
  listInventoryItems as listInventoryItemRows,
  upsertInventoryItems,
  type Actor,
  type InventoryItemDecision,
  type InventoryItemEvidence,
  type InventoryItemRecommendation,
  type NestedInventoryItem,
  type InventoryItem,
  type InventoryItemWithExclusion,
  type UpsertedInventoryItem,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import {
  isWithinPath,
  normalizeWindowsPath,
  windowsPathName,
  windowsPathParent,
} from '../../lib/windows-path';
import type { InventoryItemInput } from '../../schemas/discovery';

export type ProposedInventoryItem = UpsertedInventoryItem & {
  /** Existing inventory items whose root is an ancestor of this one. */
  coveredBy: NestedInventoryItem[];
  /** Existing inventory items beneath this one (capped). */
  covers: NestedInventoryItem[];
};

const ancestorsOf = (normalizedPath: string): string[] => {
  const ancestors: string[] = [];
  for (
    let parent = windowsPathParent(normalizedPath);
    parent !== null;
    parent = windowsPathParent(parent)
  ) {
    ancestors.push(parent);
  }

  return ancestors;
};

/**
 * Records the agent's proposals for the directory it holds. Each root path
 * must be that directory or lie beneath it: a worker can only report on what
 * it has claimed. Never touches human decisions. Nesting is allowed; each
 * result reports the inventory items it sits inside or contains, for the agent and
 * reviewer to judge.
 */
export async function proposeInventoryItems(
  queueItemId: string,
  claimToken: string,
  workerId: string | null,
  inventoryItems: InventoryItemInput[],
): Promise<ProposedInventoryItem[]> {
  const claimed = await getQueueItemById(db, queueItemId);
  if (!claimed) throw new DiscoveryError('not_found', 'queue item not found');

  const normalized = inventoryItems.map((c) => {
    const { path, normalizedPath } = normalizeWindowsPath(c.rootPath);

    return {
      kind: c.kind,
      rootPath: path,
      normalizedRootPath: normalizedPath,
      displayName: c.displayName ?? windowsPathName(path),
      summary: c.summary,
      recommendation: c.recommendation,
      confidence: c.confidence,
      recommendationReason: c.reason,
      // This app compiles without strictNullChecks, which turns the schema's
      // `T | null` fields optional; the validated shape matches InventoryItemEvidence.
      evidence: c.evidence as InventoryItemEvidence,
    };
  });

  const outside = normalized.filter(
    (c) =>
      c.normalizedRootPath !== claimed.normalizedPath &&
      !isWithinPath(claimed.normalizedPath, c.normalizedRootPath),
  );
  if (outside.length > 0) {
    throw new DiscoveryError(
      'conflict',
      `paths are not inside the claimed directory ${claimed.path}`,
      { paths: outside.map((c) => c.rootPath) },
    );
  }

  const upserted = await upsertInventoryItems(db, queueItemId, {
    claimToken,
    workerId,
    inventoryItems: normalized,
  });

  // After the upsert, so inventory items proposed together report each other.
  return Promise.all(
    upserted.map(async (result) => ({
      ...result,
      ...(await findNestedInventoryItems(
        db,
        result.inventoryItem.sourceId,
        result.inventoryItem.normalizedRootPath,
        ancestorsOf(result.inventoryItem.normalizedRootPath),
      )),
    })),
  );
}

export async function listSourceInventoryItems(
  sourceId: string,
  filters: {
    jobId?: string;
    recommendation?: InventoryItemRecommendation;
    decision?: InventoryItemDecision;
    pathPrefix?: string;
    after?: string;
    limit?: number;
  },
): Promise<InventoryItem[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listInventoryItemRows(db, {
    sourceId,
    jobId: filters.jobId,
    recommendation: filters.recommendation,
    decision: filters.decision,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    after: filters.after,
    limit: filters.limit,
  });
}

export const getInventoryItem = (
  id: string,
): Promise<InventoryItemWithExclusion> => getInventoryItemById(db, id);

export const decideInventoryItem = (
  id: string,
  input: { decision: InventoryItemDecision; note?: string | null },
  actor: Actor,
): Promise<InventoryItem> =>
  decideInventoryItemRow(db, id, { ...input, actor });
