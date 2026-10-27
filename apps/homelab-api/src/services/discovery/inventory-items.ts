import {
  DiscoveryError,
  decideInventoryItem as decideInventoryItemRow,
  findNestedInventoryItems,
  getQueueItemById,
  getInventoryItemById,
  getSourceById,
  countInventoryItems,
  listInventoryItems as listInventoryItemRows,
  inventoryQueueItemDirectory as inventoryQueueItemDirectoryRow,
  promoteInventoryItem as promoteInventoryItemRow,
  upsertInventoryItems,
  type Actor,
  type InventoryItemDecision,
  type InventoryItemKind,
  type InventoryItemEvidence,
  type InventoryItemRecommendation,
  type NestedInventoryItem,
  type InventoriedDirectory,
  type InventoryItem,
  type InventoryItemWithExclusion,
  type UpsertedInventoryItem,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { normalizeWindowsPath, windowsPathName } from '../../lib/windows-path';
import type {
  InventoryItemInput,
  InventoryDirectoryBody,
  PromoteInventoryItemBody,
} from '../../schemas/discovery';
import { ancestorsOf, assertWithinClaimedDirectory } from './paths';

export type ProposedInventoryItem = UpsertedInventoryItem & {
  /** Existing inventory items whose root is an ancestor of this one. */
  coveredBy: NestedInventoryItem[];
  /** Existing inventory items beneath this one (capped). */
  covers: NestedInventoryItem[];
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

  assertWithinClaimedDirectory(
    claimed,
    normalized.map((c) => ({
      path: c.rootPath,
      normalizedPath: c.normalizedRootPath,
    })),
    { allowSelf: true, subject: 'paths' },
  );

  const upserted = await upsertInventoryItems(db, queueItemId, {
    claimToken,
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
    queueItemId?: string;
    recommendation?: InventoryItemRecommendation;
    decision?: InventoryItemDecision;
    kind?: InventoryItemKind;
    pathPrefix?: string;
    path?: string;
    q?: string;
    after?: string;
    offset?: number;
    limit?: number;
  },
): Promise<{ items: InventoryItem[]; total: number }> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  const options = {
    sourceId,
    jobId: filters.jobId,
    queueItemId: filters.queueItemId,
    recommendation: filters.recommendation,
    decision: filters.decision,
    kind: filters.kind,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    normalizedPath: filters.path
      ? normalizeWindowsPath(filters.path).normalizedPath
      : undefined,
    search: filters.q,
    after: filters.after,
    offset: filters.offset,
    limit: filters.limit,
  };
  const [items, total] = await Promise.all([
    listInventoryItemRows(db, options),
    countInventoryItems(db, options),
  ]);

  return { items, total };
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

/**
 * A human promotes a path the agent skipped. The path must lie strictly
 * beneath the queue item's directory: it is that directory's skip being
 * corrected, not a way to add arbitrary paths.
 */
export async function promoteInventoryItem(
  queueItemId: string,
  body: PromoteInventoryItemBody,
  actor: Actor,
): Promise<
  InventoryItem & {
    coveredBy: NestedInventoryItem[];
    covers: NestedInventoryItem[];
  }
> {
  const queueItem = await getQueueItemById(db, queueItemId);
  if (!queueItem) throw new DiscoveryError('not_found', 'queue item not found');

  const { path, normalizedPath } = normalizeWindowsPath(body.path);

  assertWithinClaimedDirectory(queueItem, [{ path, normalizedPath }], {
    allowSelf: false,
    subject: 'promoted paths',
  });

  const inventoryItem = await promoteInventoryItemRow(db, queueItemId, {
    kind: body.kind,
    rootPath: path,
    normalizedRootPath: normalizedPath,
    displayName: body.displayName ?? windowsPathName(path),
    skipReason: body.skipReason,
    note: body.note,
    actor,
  });

  return {
    ...inventoryItem,
    ...(await findNestedInventoryItems(
      db,
      inventoryItem.sourceId,
      normalizedPath,
      ancestorsOf(normalizedPath),
    )),
  };
}

/**
 * A human adds a queue item's whole directory to the inventory (approving the
 * agent's proposal if there is one), which skips the active job's queued items
 * beneath it.
 */
export async function inventoryDirectory(
  queueItemId: string,
  body: InventoryDirectoryBody,
  actor: Actor,
): Promise<
  InventoriedDirectory & {
    coveredBy: NestedInventoryItem[];
    covers: NestedInventoryItem[];
  }
> {
  const queueItem = await getQueueItemById(db, queueItemId);
  if (!queueItem) throw new DiscoveryError('not_found', 'queue item not found');

  const result = await inventoryQueueItemDirectoryRow(db, queueItemId, {
    displayName: windowsPathName(queueItem.path),
    note: body.note,
    actor,
  });

  return {
    ...result,
    ...(await findNestedInventoryItems(
      db,
      result.inventoryItem.sourceId,
      queueItem.normalizedPath,
      ancestorsOf(queueItem.normalizedPath),
    )),
  };
}
