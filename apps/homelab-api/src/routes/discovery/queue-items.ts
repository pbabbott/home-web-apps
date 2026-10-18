import { Router } from 'express';
import { validateBody, validateParams } from '@abbottland/express';
import { recordInventoryItems } from '../../controllers/discovery/inventory-items';
import {
  completeQueueItem,
  failQueueItem,
  heartbeatQueueItem,
  retryQueueItem,
  skipQueueItem,
} from '../../controllers/discovery/queue-items';
import {
  completeQueueItemBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  queueItemIdParamsSchema,
  recordInventoryItemsBodySchema,
  skipQueueItemBodySchema,
} from '../../schemas/discovery';

export const queueItemsRouter = Router();

queueItemsRouter.post(
  '/queue-items/:id/heartbeat',
  validateParams(queueItemIdParamsSchema),
  validateBody(heartbeatQueueItemBodySchema),
  heartbeatQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/inventory-items',
  validateParams(queueItemIdParamsSchema),
  validateBody(recordInventoryItemsBodySchema),
  recordInventoryItems,
);
queueItemsRouter.post(
  '/queue-items/:id/complete',
  validateParams(queueItemIdParamsSchema),
  validateBody(completeQueueItemBodySchema),
  completeQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/fail',
  validateParams(queueItemIdParamsSchema),
  validateBody(failQueueItemBodySchema),
  failQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/skip',
  validateParams(queueItemIdParamsSchema),
  validateBody(skipQueueItemBodySchema),
  skipQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/retry',
  validateParams(queueItemIdParamsSchema),
  retryQueueItem,
);
