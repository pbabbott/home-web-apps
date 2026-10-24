import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  cancelDiscoveryJob,
  completeDiscoveryJob,
  failDiscoveryJob,
  getDiscoveryJob,
  listDiscoveryJobs,
} from '../../controllers/discovery/discovery-jobs';
import {
  claimQueueItem,
  retryFailedQueueItems,
  enqueueQueueItems,
  listJobQueueItems,
} from '../../controllers/discovery/queue-items';
import {
  claimQueueItemBodySchema,
  enqueueQueueItemsBodySchema,
  failDiscoveryJobBodySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  jobQueueItemListQuerySchema,
} from '../../schemas/discovery';

export const discoveryJobsRouter = Router();

discoveryJobsRouter.get(
  '/discovery-jobs/:id/queue-items',
  validateParams(jobIdParamsSchema),
  validateQuery(jobQueueItemListQuerySchema),
  listJobQueueItems,
);
discoveryJobsRouter.get(
  '/discovery-jobs',
  validateQuery(jobListQuerySchema),
  listDiscoveryJobs,
);
discoveryJobsRouter.get(
  '/discovery-jobs/:id',
  validateParams(jobIdParamsSchema),
  getDiscoveryJob,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/complete',
  validateParams(jobIdParamsSchema),
  completeDiscoveryJob,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/cancel',
  validateParams(jobIdParamsSchema),
  cancelDiscoveryJob,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/fail',
  validateParams(jobIdParamsSchema),
  validateBody(failDiscoveryJobBodySchema),
  failDiscoveryJob,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/queue-items',
  validateParams(jobIdParamsSchema),
  validateBody(enqueueQueueItemsBodySchema),
  enqueueQueueItems,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/retry-failed',
  validateParams(jobIdParamsSchema),
  retryFailedQueueItems,
);
discoveryJobsRouter.post(
  '/discovery-jobs/:id/queue-items/claim',
  validateParams(jobIdParamsSchema),
  validateBody(claimQueueItemBodySchema),
  claimQueueItem,
);
