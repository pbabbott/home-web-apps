import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  decideInventoryItem,
  getInventoryItem,
  listSourceInventoryItems,
  proposeInventoryItems,
} from '../../controllers/discovery/inventory-items';
import { parseActor } from '../../lib/actor';
import {
  decideInventoryItemBodySchema,
  proposeInventoryItemsBodySchema,
  queueItemIdParamsSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const inventoryItemsRouter = Router();

inventoryItemsRouter.post(
  '/queue-items/:id/inventory-items',
  validateParams(queueItemIdParamsSchema),
  validateBody(proposeInventoryItemsBodySchema),
  proposeInventoryItems,
);
inventoryItemsRouter.get(
  '/sources/:id/inventory-items',
  validateParams(sourceIdParamsSchema),
  validateQuery(inventoryItemListQuerySchema),
  listSourceInventoryItems,
);
inventoryItemsRouter.get(
  '/inventory-items/:id',
  validateParams(inventoryItemIdParamsSchema),
  getInventoryItem,
);
inventoryItemsRouter.patch(
  '/inventory-items/:id/decision',
  parseActor,
  validateParams(inventoryItemIdParamsSchema),
  validateBody(decideInventoryItemBodySchema),
  decideInventoryItem,
);
