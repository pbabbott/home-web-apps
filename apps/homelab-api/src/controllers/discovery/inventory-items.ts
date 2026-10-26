import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  DecideInventoryItemBody,
  InventoryDirectoryBody,
  ProposeInventoryItemsBody,
  PromoteInventoryItemBody,
  QueueItemIdParams,
  InventoryItemIdParams,
  InventoryItemListQuery,
  SourceIdParams,
} from '../../schemas/discovery';
import { MAX_INVENTORY_ITEMS_PER_REQUEST } from '../../schemas/discovery';

// Does: create or update the agent's recommendation for backup units found in
// a claimed directory.
// Who: agent (propose_inventory_items).
export const proposeInventoryItemsOperation = {
  summary: 'Propose inventory items for a claimed directory',
  description: `An inventory item is a proposed backup unit, usually a directory (one repository or photo folder, not one per file or subfolder) and occasionally a standalone file. It creates no queue items. Upserts by source + normalized root path, so repeating a call or rediscovering in a later job updates the same inventory item instead of duplicating it. Each root path must be the claimed directory or lie inside it. Writes only the agent's fields (recommendation, confidence, reason, evidence); it never touches a human decision, and a recommendation is never an approval. Audit events are written only when an inventory item is created or its recommendation/confidence changes. Guardrails (400): back_up/skip need medium or high confidence (low means needs_review); a git repository can only be skipped when its local state is known and clean. Nesting is allowed, but each result lists coveredBy (existing inventory items whose root is an ancestor) and covers (existing inventory items beneath it), with their decision; nothing is inherited, so check them and avoid proposing a repository's internal folders. A path covered by an exclusion rule rejects the batch (409). Up to ${MAX_INVENTORY_ITEMS_PER_REQUEST} per call.`,
  mcp: {
    name: 'propose_inventory_items',
    description: `Recommend backup units from the directory you claimed: a repo or project root, a data folder, or one file (max ${MAX_INVENTORY_ITEMS_PER_REQUEST} per call). Re-proposing a path updates your recommendation, never a human's decision. Queues nothing. A path under an exclusion rule rejects the batch. Results list coveredBy / covers (existing items containing or inside it); a non-empty coveredBy means probably not a separate unit.`,
  },
} satisfies Operation;

export const proposeInventoryItems = handle(
  'POST /queue-items/:id/inventory-items',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, inventoryItems } =
      req.body as ProposeInventoryItemsBody;
    const results = await discoveryService.proposeInventoryItems(
      id,
      claimToken,
      inventoryItems,
    );
    res.status(200).json(
      results.map(({ inventoryItem, created, changed, coveredBy, covers }) => ({
        ...inventoryItem,
        created,
        changed,
        coveredBy,
        covers,
      })),
    );
  },
);

// Does: page through a source's inventory items with filters.
// Who: human (REST) and agent (list_inventory_items).
export const listInventoryItemsOperation = {
  summary: 'List a source’s inventory items',
  description:
    'Returns `{ items, total }`; `total` counts every match, ignoring paging. Ordered by normalizedRootPath. Up to `limit` (default 100, max 500) per page; pass the last normalizedRootPath as `after` for the next page, or `offset` for numbered pages. Filter by last-proposing job, recommendation, decision, kind, path prefix, exact path, or a case-insensitive search `q` over path, name and summary.',
  mcp: {
    name: 'list_inventory_items',
    description:
      'Inventory items already recorded for a source, with human decisions. Filter by recommendation, decision, kind, jobId, pathPrefix, exact path or search text `q`; pass `next` back as `after` for more. `total` is the number of matches.',
  },
  hud: '/exodus/inventory',
} satisfies Operation;

export const listSourceInventoryItems = handle(
  'GET /sources/:id/inventory-items',
  async (req, res) => {
    const { id } = req.params as SourceIdParams;
    const filters = req.query as unknown as InventoryItemListQuery;
    res
      .status(200)
      .json(await discoveryService.listSourceInventoryItems(id, filters));
  },
);

// Does: fetch one inventory item, with how exclusion rules currently treat it.
// Who: human (home-hud inventory details modal). No MCP tool: the agent lists
// inventory items with list_inventory_items.
export const getInventoryItemOperation = {
  summary: 'Get an inventory item',
  description:
    'Includes `exclusion`: `none`, `selective` or `excluded`, with the deciding rule ids. An excluded or selective path cannot be approved.',
  hud: '/exodus/inventory',
} satisfies Operation;

export const getInventoryItem = handle(
  'GET /inventory-items/:id',
  async (req, res) => {
    const { id } = req.params as InventoryItemIdParams;
    res.status(200).json(await discoveryService.getInventoryItem(id));
  },
);

// Does: record a human's approval or rejection.
// Who: human only (REST). Deliberately no MCP tool.
export const decideInventoryItemOperation = {
  summary: 'Approve or reject an inventory item',
  description:
    'Sets `approved`, `rejected`, or back to `pending`, with an optional note. Only a human actor may decide (X-Actor-Type other than human is 409). Approval is refused for paths under an exclusion rule. An approval normally covers the inventory item’s whole subtree; it is the authorization and scope for a future copy workflow. Approving a `directory` item also marks the active job’s still-`queued` items inside it `skipped` (see inventory-directory); reversing the approval does not requeue them. Repeating the current decision and note changes nothing and records no audit event. Rediscovery never resets a decision.',
  hud: '/exodus/inventory',
} satisfies Operation;

export const decideInventoryItem = handle(
  'PATCH /inventory-items/:id/decision',
  async (req, res) => {
    const { id } = req.params as InventoryItemIdParams;
    const body = req.body as DecideInventoryItemBody;
    res
      .status(200)
      .json(await discoveryService.decideInventoryItem(id, body, actorOf(res)));
  },
);

// Does: let a human turn a path the agent skipped into an approved inventory
// item.
// Who: human only (REST). Deliberately no MCP tool.
export const promoteInventoryItemOperation = {
  summary: 'Promote a skipped path to an approved inventory item',
  description:
    'Corrects an agent skip. The path must be inside the queue item’s directory (usually one listed in its `skipped`). Creates an inventory item that is already `approved` (promoting is the human’s approval) with a `back_up` recommendation, and writes an `inventory_item.promoted` audit event. The queue item’s `result` is left as the agent wrote it. Only a human actor may promote (409 otherwise). Refused with 409 when the path already has an inventory item (`inventoryItemId` in the details, nothing is overwritten), when an exclusion rule covers it, or when it is outside the directory. Lists `coveredBy` / `covers` like a proposal.',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const promoteInventoryItem = handle(
  'POST /queue-items/:id/promote',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const body = req.body as PromoteInventoryItemBody;
    res
      .status(201)
      .json(
        await discoveryService.promoteInventoryItem(id, body, actorOf(res)),
      );
  },
);

// Does: let a human add a queue item's whole directory to the inventory.
// Who: human only (REST). Deliberately no MCP tool.
export const inventoryDirectoryOperation = {
  summary: 'Add a whole directory to the inventory',
  description:
    'Approves the directory as one inventory item, so exploring inside it is unnecessary. Approves the agent’s proposal for the queue item’s directory when there is one (its agent fields are untouched, like any decision), otherwise creates an approved `directory` item with a `back_up` recommendation. Either way, the active job’s still-`queued` items inside the directory are marked `skipped`, and later enqueues or claims under it are skipped too (`queue_items.inventoried` audit event); in-progress and finished items are untouched. Only a human actor may do this (409 otherwise). Refused with 409 when an exclusion rule covers the path. `created` says whether the item is new; `skippedQueueItems` how many queue items were skipped now. Lists `coveredBy` / `covers` like a proposal.',
  hud: '/exodus/jobs/[id]',
} satisfies Operation;

export const inventoryDirectory = handle(
  'POST /queue-items/:id/inventory-directory',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const body = req.body as InventoryDirectoryBody;
    res
      .status(200)
      .json(await discoveryService.inventoryDirectory(id, body, actorOf(res)));
  },
);
