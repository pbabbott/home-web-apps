import * as discoveryService from '../../services/discovery';
import { handle } from './handle';
import type {
  InventoryItemListQuery,
  QueueItemIdParams,
  RecordInventoryItemsBody,
  SourceIdParams,
} from '../../schemas/discovery';

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
