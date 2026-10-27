import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  checkPathCoverage,
  decideInventoryItem,
  getInventoryItem,
  inventoryDirectory,
  listSourceInventoryItems,
  promoteInventoryItem,
  proposeInventoryItems,
} from '../../controllers/discovery/inventory-items';
import { parseActor } from '../../lib/actor';
import {
  decideInventoryItemBodySchema,
  inventoryDirectoryBodySchema,
  promoteInventoryItemBodySchema,
  proposeInventoryItemsBodySchema,
  queueItemIdParamsSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  pathCoverageQuerySchema,
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
  '/sources/:id/path-coverage',
  validateParams(sourceIdParamsSchema),
  validateQuery(pathCoverageQuerySchema),
  checkPathCoverage,
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
inventoryItemsRouter.post(
  '/queue-items/:id/promote',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  validateBody(promoteInventoryItemBodySchema),
  promoteInventoryItem,
);
inventoryItemsRouter.post(
  '/queue-items/:id/inventory-directory',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  validateBody(inventoryDirectoryBodySchema),
  inventoryDirectory,
);
