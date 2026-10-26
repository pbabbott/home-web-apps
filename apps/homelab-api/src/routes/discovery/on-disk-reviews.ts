import { Router } from 'express';
import { validateParams, validateQuery } from '@abbottland/express';
import {
  listOnDiskReviews,
  reviewOnDisk,
  unreviewOnDisk,
} from '../../controllers/discovery/on-disk-reviews';
import { parseActor } from '../../lib/actor';
import {
  onDiskReviewListQuerySchema,
  queueItemIdParamsSchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const onDiskReviewsRouter = Router();

onDiskReviewsRouter.post(
  '/queue-items/:id/on-disk-review',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  reviewOnDisk,
);
onDiskReviewsRouter.delete(
  '/queue-items/:id/on-disk-review',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  unreviewOnDisk,
);
onDiskReviewsRouter.get(
  '/sources/:id/on-disk-reviews',
  validateParams(sourceIdParamsSchema),
  validateQuery(onDiskReviewListQuerySchema),
  listOnDiskReviews,
);
