import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  claimAnyQueueItem,
  completeQueueItem,
  failQueueItem,
  heartbeatQueueItem,
  listSkippedGroupMatches,
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
  skippedGroupMatchesQuerySchema,
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

queueItemsRouter.get(
  '/queue-items/:id/skipped-group-matches',
  validateParams(queueItemIdParamsSchema),
  validateQuery(skippedGroupMatchesQuerySchema),
  listSkippedGroupMatches,
);
