import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  createDiscoveryJob,
  listSourceJobs,
} from '../../controllers/discovery/discovery-jobs';
import { listSourceQueueItems } from '../../controllers/discovery/queue-items';
import { createSource, listSources } from '../../controllers/discovery/sources';
import {
  createDiscoveryJobBodySchema,
  createSourceBodySchema,
  queueItemListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const sourcesRouter = Router();

sourcesRouter.get('/sources', listSources);
sourcesRouter.post(
  '/sources',
  validateBody(createSourceBodySchema),
  createSource,
);
sourcesRouter.post(
  '/sources/:id/discovery-jobs',
  validateParams(sourceIdParamsSchema),
  validateBody(createDiscoveryJobBodySchema),
  createDiscoveryJob,
);
sourcesRouter.get(
  '/sources/:id/discovery-jobs',
  validateParams(sourceIdParamsSchema),
  listSourceJobs,
);
sourcesRouter.get(
  '/sources/:id/queue-items',
  validateParams(sourceIdParamsSchema),
  validateQuery(queueItemListQuerySchema),
  listSourceQueueItems,
);
