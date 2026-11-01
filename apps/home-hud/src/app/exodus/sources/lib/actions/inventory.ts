'use server';

import { errorMessage } from '../errors';
import type {
  InventoryItemDecision,
  InventoryItem,
  PathCoverage,
} from '../homelab-api';
import {
  type ActionResult,
  send,
  post,
  patch,
  HOMELAB_API_URL,
} from './request';

/**
 * A human's decision on an inventory item. Sent as the default (human) actor:
 * the API refuses anything else. An omitted note keeps the note when the
 * decision is unchanged and clears it when it changes.
 */
export async function decideInventoryItem(
  id: string,
  decision: InventoryItemDecision,
  note?: string | null,
): Promise<ActionResult<InventoryItem>> {
  return patch<InventoryItem>(`/inventory-items/${id}/decision`, {
    decision,
    ...(note !== undefined ? { note } : {}),
  });
}

/** Whether a path, at any depth, rolls up to an inventory item of the source. Read-only. */
export async function checkPathCoverage(
  sourceId: string,
  path: string,
): Promise<ActionResult<PathCoverage>> {
  return send<PathCoverage>(
    'GET',
    `/sources/${sourceId}/path-coverage?${new URLSearchParams({ path })}`,
  );
}

export interface PromoteSkippedPathInput {
  path: string;
  kind: 'file' | 'directory';
  note?: string;
  /** Why the agent skipped it, for the audit trail. */
  skipReason?: string;
}

/**
 * A human promotes a path the agent skipped: it becomes an approved inventory
 * item. Sent as the default (human) actor: the API refuses anything else.
 */
export async function promoteSkippedPath(
  queueItemId: string,
  input: PromoteSkippedPathInput,
): Promise<ActionResult<InventoryItem>> {
  return post<InventoryItem>(`/queue-items/${queueItemId}/promote`, input);
}

export interface InventoriedDirectory {
  inventoryItem: InventoryItem;
  /** False when the agent had already proposed the directory. */
  created: boolean;
  /** Queued items of the active job skipped because they sit inside it. */
  skippedQueueItems: number;
}

/**
 * A human adds a queue item's whole directory to the inventory, approved: the
 * agent's proposal is approved if there is one, else an item is created. The
 * job's queued items inside it are skipped. Sent as the default (human) actor.
 */
export async function inventoryWholeDirectory(
  queueItemId: string,
  note?: string,
): Promise<ActionResult<InventoriedDirectory>> {
  return post<InventoriedDirectory>(
    `/queue-items/${queueItemId}/inventory-directory`,
    note ? { note } : {},
  );
}

/**
 * Normalized paths of the source's inventory items at or beneath `pathPrefix`;
 * only the approved ones when `approvedOnly`.
 */
export async function listInventoryPathsUnder(
  sourceId: string,
  pathPrefix: string,
  approvedOnly = false,
): Promise<ActionResult<string[]>> {
  try {
    const params = new URLSearchParams({ pathPrefix, limit: '500' });
    if (approvedOnly) params.set('decision', 'approved');
    const res = await fetch(
      `${HOMELAB_API_URL}/sources/${sourceId}/inventory-items?${params}`,
      { cache: 'no-store' },
    );

    if (!res.ok) return { ok: false, error: await errorMessage(res) };

    const { items } = (await res.json()) as { items: InventoryItem[] };

    return { ok: true, data: items.map((i) => i.normalizedRootPath) };
  } catch (err) {
    console.error(`GET inventory-items under ${pathPrefix} failed:`, err);
    return { ok: false, error: 'Could not reach homelab-api' };
  }
}
