import * as discoveryService from '../../services/discovery';
import { actorOf } from '../../lib/actor';
import { handle } from './handle';
import type { Operation } from '../operation';
import type {
  DecideInventoryItemBody,
  ProposeInventoryItemsBody,
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
    description: `Record your backup recommendation (an inventory item; it creates no queue items) for one or more logical backup units (a project/repository root, a personal-data folder, a standalone file) found while inspecting a claimed directory. Idempotent per path: re-proposing updates the existing inventory item and never changes a human's approval or rejection. Give a short summary, a recommendation (back_up | skip | needs_review), confidence (low | medium | high, where low must be needs_review), a reason, and evidence made only of facts you observed, with unknowns in openQuestions. A repository is ONE inventory item; do not propose its subfolders. In a mixed folder such as Downloads, propose each keeper as its own file (or coherent subfolder) item and never the mixed folder itself. Each result carries coveredBy / covers (existing inventory items that contain or sit inside this one): if coveredBy is non-empty, reconsider whether this should be a separate inventory item. A git repo may only be recommended skip if you checked that it has no uncommitted changes, untracked files or unpushed commits; a public remote alone is not enough, so otherwise use needs_review. Maximum ${MAX_INVENTORY_ITEMS_PER_REQUEST} per call.`,
  },
} satisfies Operation;

export const proposeInventoryItems = handle(
  'POST /queue-items/:id/inventory-items',
  async (req, res) => {
    const { id } = req.params as QueueItemIdParams;
    const { claimToken, workerId, inventoryItems } =
      req.body as ProposeInventoryItemsBody;
    const results = await discoveryService.proposeInventoryItems(
      id,
      claimToken,
      workerId ?? null,
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
    'Ordered by normalizedRootPath. Up to `limit` (default 100, max 500) per page; pass the last normalizedRootPath as `after` for the next page. Filter by last-proposing job, recommendation, decision, or path prefix.',
  mcp: {
    name: 'list_inventory_items',
    description:
      'List the inventory items already recorded for a source (filter by recommendation, decision, jobId or pathPrefix). Check this before proposing, to see what earlier runs found and what a human has already decided.',
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
// Who: human. No MCP tool.
export const getInventoryItemOperation = {
  summary: 'Get an inventory item',
  description:
    'Includes `exclusion`: `none`, `selective` or `excluded`, with the deciding rule ids. An excluded or selective path cannot be approved.',
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
    'Sets `approved`, `rejected`, or back to `pending`, with an optional note. Only a human actor may decide (X-Actor-Type other than human is 409). Approval is refused for paths under an exclusion rule. An approval normally covers the inventory item’s whole subtree; it is the authorization and scope for a future copy workflow and changes nothing else. Repeating the current decision and note changes nothing and records no audit event. Rediscovery never resets a decision.',
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
