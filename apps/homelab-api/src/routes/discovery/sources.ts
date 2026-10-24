import { Router } from 'express';
import { parseActor } from '../../lib/actor';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  createDiscoveryJob,
  listSourceJobs,
} from '../../controllers/discovery/discovery-jobs';
import {
  listKnownSkips,
  listSourceQueueItems,
} from '../../controllers/discovery/queue-items';
import {
  deleteSourceConnection,
  getSourceConnection,
  previewSourceFile,
  saveSourceConnection,
  testSourceConnection,
} from '../../controllers/discovery/source-connections';
import {
  createSource,
  listSources,
  updateSource,
} from '../../controllers/discovery/sources';
import {
  createDiscoveryJobBodySchema,
  createSourceBodySchema,
  knownSkipListQuerySchema,
  previewQuerySchema,
  saveSourceConnectionBodySchema,
  queueItemListQuerySchema,
  sourceIdParamsSchema,
  updateSourceBodySchema,
} from '../../schemas/discovery';

export const sourcesRouter = Router();

sourcesRouter.get('/sources', listSources);
sourcesRouter.post(
  '/sources',
  validateBody(createSourceBodySchema),
  createSource,
);
sourcesRouter.patch(
  '/sources/:id',
  validateParams(sourceIdParamsSchema),
  validateBody(updateSourceBodySchema),
  updateSource,
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
sourcesRouter.get(
  '/sources/:id/known-skips',
  validateParams(sourceIdParamsSchema),
  validateQuery(knownSkipListQuerySchema),
  listKnownSkips,
);
sourcesRouter.get(
  '/sources/:id/connection',
  validateParams(sourceIdParamsSchema),
  getSourceConnection,
);
sourcesRouter.put(
  '/sources/:id/connection',
  parseActor,
  validateParams(sourceIdParamsSchema),
  validateBody(saveSourceConnectionBodySchema),
  saveSourceConnection,
);
sourcesRouter.delete(
  '/sources/:id/connection',
  parseActor,
  validateParams(sourceIdParamsSchema),
  deleteSourceConnection,
);
sourcesRouter.post(
  '/sources/:id/connection/test',
  validateParams(sourceIdParamsSchema),
  testSourceConnection,
);
sourcesRouter.get(
  '/sources/:id/preview',
  validateParams(sourceIdParamsSchema),
  validateQuery(previewQuerySchema),
  previewSourceFile,
);
