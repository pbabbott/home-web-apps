import { Router } from 'express';
import { validateBody, validateParams } from '@abbottland/express';
import {
  claimAnyQueueItem,
  completeQueueItem,
  failQueueItem,
  heartbeatQueueItem,
  releaseQueueItem,
  retryQueueItem,
  skipQueueItem,
} from '../../controllers/discovery/queue-items';
import {
  claimAnyQueueItemBodySchema,
  completeQueueItemBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  queueItemIdParamsSchema,
  releaseQueueItemBodySchema,
  skipQueueItemBodySchema,
} from '../../schemas/discovery';

export const queueItemsRouter = Router();

queueItemsRouter.post(
  '/queue-items/claim',
  validateBody(claimAnyQueueItemBodySchema),
  claimAnyQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/heartbeat',
  validateParams(queueItemIdParamsSchema),
  validateBody(heartbeatQueueItemBodySchema),
  heartbeatQueueItem,
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
  '/queue-items/:id/release',
  validateParams(queueItemIdParamsSchema),
  validateBody(releaseQueueItemBodySchema),
  releaseQueueItem,
);
queueItemsRouter.post(
  '/queue-items/:id/retry',
  validateParams(queueItemIdParamsSchema),
  retryQueueItem,
);
