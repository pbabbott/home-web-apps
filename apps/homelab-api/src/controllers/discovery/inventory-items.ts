import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  InventoryItemIdParams,
  InventoryItemListQuery,
  QueueItemIdParams,
  RecordInventoryItemsBody,
  ReviewInventoryItemBody,
  ReviewInventoryItemsBody,
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
    'Files and directories found by any job of the source, ordered by normalizedPath. Up to `limit` (default 500, max 1000) per page; pass the last normalizedPath as `after` for the next page. Filter by last-seen job, type, review disposition, direct parent, or path prefix.',
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

// Does: fetch one inventory item, with how exclusion rules currently treat it.
// Who: human (home-hud inventory browser). No MCP tool.
export const getInventoryItemOperation = {
  summary: 'Get an inventory item',
  description:
    'Includes `exclusion`: `none`, `selective` (the item itself cannot be a candidate) or `excluded` (an exclude_subtree rule covers it), with the deciding rule ids.',
} satisfies Operation;

export const getInventoryItem = handle(
  'GET /inventory-items/:id',
  async (req, res) => {
    const { id } = req.params as InventoryItemIdParams;
    res.status(200).json(await discoveryService.getInventoryItem(id));
  },
);

// Does: record a human's review decision about one item.
// Who: human (home-hud inventory browser). No MCP tool.
export const reviewInventoryItemOperation = {
  summary: 'Set an inventory item’s review disposition',
  description:
    'Sets `candidate`, `not_needed` or `needs_review`, with an optional note. Touches only the review columns, never queue state or filesystem facts, and rediscovery never resets it. An item covered by an exclusion rule cannot be marked `candidate` (409, with the blocking rule ids). Repeating the current decision changes nothing and records no audit event. Send X-Actor-Type / X-Actor-Id to attribute the decision.',
} satisfies Operation;

export const reviewInventoryItem = handle(
  'PATCH /inventory-items/:id/review',
  async (req, res) => {
    const { id } = req.params as InventoryItemIdParams;
    const body = req.body as ReviewInventoryItemBody;
    res
      .status(200)
      .json(await discoveryService.reviewInventoryItem(id, body, actorOf(res)));
  },
);

// Does: apply one review decision to many items at once.
// Who: human (home-hud inventory browser, multi-select). No MCP tool.
export const reviewInventoryItemsOperation = {
  summary: 'Apply a review disposition to several inventory items',
  description:
    'All or nothing: an unknown id (404, listing `missingIds`) or an item that may not be a candidate (409, listing `blocked`) fails the whole request and changes nothing. Up to 200 ids. Records one audit event listing the changed items and their prior dispositions.',
} satisfies Operation;

export const reviewInventoryItems = handle(
  'POST /inventory-items/review',
  async (req, res) => {
    const body = req.body as ReviewInventoryItemsBody;
    res
      .status(200)
      .json(await discoveryService.reviewInventoryItems(body, actorOf(res)));
  },
);
