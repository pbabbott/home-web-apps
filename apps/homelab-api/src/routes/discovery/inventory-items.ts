import { Router } from 'express';
import { validateBody, validateParams } from '@abbottland/express';
import {
  getInventoryItem,
  reviewInventoryItem,
  reviewInventoryItems,
} from '../../controllers/discovery/inventory-items';
import { parseActor } from '../../lib/actor';
import {
  inventoryItemIdParamsSchema,
  reviewInventoryItemBodySchema,
  reviewInventoryItemsBodySchema,
} from '../../schemas/discovery';

export const inventoryItemsRouter = Router();

inventoryItemsRouter.post(
  '/inventory-items/review',
  parseActor,
  validateBody(reviewInventoryItemsBodySchema),
  reviewInventoryItems,
);
inventoryItemsRouter.get(
  '/inventory-items/:id',
  validateParams(inventoryItemIdParamsSchema),
  getInventoryItem,
);
inventoryItemsRouter.patch(
  '/inventory-items/:id/review',
  parseActor,
  validateParams(inventoryItemIdParamsSchema),
  validateBody(reviewInventoryItemBodySchema),
  reviewInventoryItem,
);
