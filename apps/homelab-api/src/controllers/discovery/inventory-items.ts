import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  InventoryItemListQuery,
  QueueItemIdParams,
  RecordInventoryItemsBody,
  SourceIdParams,
} from '../../schemas/discovery';
import { MAX_INVENTORY_ITEMS_PER_REQUEST } from '../../schemas/discovery';

// Does: upsert the files and directories found inside a claimed directory, in
// batches.
// Who: agent (record_discovered_items).
export const recordInventoryItemsOperation = {
  summary: 'Record the files and directories found in a claimed directory',
  description:
    'Upserts by source + normalized path (case-insensitive), so repeating a call or re-exploring after a crash updates the existing rows. Size and modifiedAt are refreshed when provided and kept when omitted. Every path must lie beneath the claimed directory. Send up to 200 items per call (the request body limit is 100kb); chunk larger directories.',
  mcp: {
    name: 'record_discovered_items',
    description: `Record files and subdirectories found inside a claimed directory in one batch. Maximum ${MAX_INVENTORY_ITEMS_PER_REQUEST} items per call; a larger batch is rejected outright, so for a bigger directory split the entries into chunks of at most ${MAX_INVENTORY_ITEMS_PER_REQUEST} and call this once per chunk (re-sending an item is safe). Paths must lie inside the claimed directory. Does not enqueue subdirectories: pass them as discoveredPaths to complete_directory.`,
  },
} satisfies Operation;

export const recordInventoryItems = handle(
  'POST /queue-items/:id/inventory-items',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, items } = req.body as RecordInventoryItemsBody;
    const results = await discoveryService.recordInventory(
      id,
      claimToken,
      items,
    );
    res
      .status(200)
      .json(results.map(({ item, created }) => ({ ...item, created })));
  },
);

// Does: page through a source's inventory (files and directories), ordered by
// normalizedPath, with filters.
// Who: human (home-hud inventory browser). No MCP tool.
export const listSourceInventoryItemsOperation = {
  summary: 'List a source’s inventory items',
  description:
    'Files and directories found by any job of the source, ordered by normalizedPath. Up to `limit` (default 500, max 1000) per page; pass the last normalizedPath as `after` for the next page. Filter by last-seen job, type, direct parent, or path prefix.',
} satisfies Operation;

export const listSourceInventoryItems = handle(
  'GET /sources/:id/inventory-items',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as InventoryItemListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceInventory(id, filters));
  },
);
