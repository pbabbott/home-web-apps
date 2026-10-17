import express, { type Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  configureBaseServerMiddleware,
  configureErrorHandler,
  configureHealthRoute,
  configureMetricsRoute,
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import { config } from './config';
import { getMap } from './controllers/maps';
import {
  cancelDiscoveryJob,
  claimQueueItem,
  completeDiscoveryJob,
  completeQueueItem,
  createBackupSource,
  createDiscoveryJob,
  enqueueQueueItems,
  failDiscoveryJob,
  failQueueItem,
  getDiscoveryJob,
  heartbeatQueueItem,
  listBackupSources,
  listSourceJobs,
  listSourceQueueItems,
  retryQueueItem,
  skipQueueItem,
} from './controllers/discovery';
import {
  createHost,
  deleteHost,
  getHost,
  getHostCpuMetrics,
  getHostDiskIoMetrics,
  getHostDiskSpace,
  getHostMemoryMetrics,
  getHostTemperatureMetrics,
  listHosts,
  updateHost,
} from './controllers/hosts';
import {
  getPodCpuMetrics,
  getPodMemoryMetrics,
} from './controllers/pod-metrics';
import { openApiSpec } from './openapi';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  createBackupSourceBodySchema,
  createDiscoveryJobBodySchema,
  enqueueQueueItemsBodySchema,
  failDiscoveryJobBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  queueItemIdParamsSchema,
  queueItemListQuerySchema,
  skipQueueItemBodySchema,
  sourceIdParamsSchema,
} from './schemas/discovery';
import { mapQuerySchema, mapTypeParamsSchema } from './schemas/maps';
import {
  createHostBodySchema,
  hostIdParamsSchema,
  hostListQuerySchema,
  hostMetricsRangeQuerySchema,
  updateHostBodySchema,
} from './schemas/hosts';
import {
  podMetricsParamsSchema,
  podMetricsRangeQuerySchema,
} from './schemas/pods';

export const DOCS_ROUTE = '/docs';

export const createServer = (): Express => {
  const app = express();

  configureBaseServerMiddleware(app);
  configureHealthRoute(app);
  configureMetricsRoute(app);

  app.use(DOCS_ROUTE, swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.get(
    '/maps/:type',
    validateParams(mapTypeParamsSchema),
    validateQuery(mapQuerySchema),
    getMap,
  );

  app.get('/hosts', validateQuery(hostListQuerySchema), listHosts);
  app.post('/hosts', validateBody(createHostBodySchema), createHost);
  app.get('/hosts/:id', validateParams(hostIdParamsSchema), getHost);
  app.get(
    '/hosts/:id/metrics/cpu',
    validateParams(hostIdParamsSchema),
    validateQuery(hostMetricsRangeQuerySchema),
    getHostCpuMetrics,
  );
  app.get(
    '/hosts/:id/metrics/memory',
    validateParams(hostIdParamsSchema),
    validateQuery(hostMetricsRangeQuerySchema),
    getHostMemoryMetrics,
  );
  app.get(
    '/hosts/:id/metrics/disk-io',
    validateParams(hostIdParamsSchema),
    validateQuery(hostMetricsRangeQuerySchema),
    getHostDiskIoMetrics,
  );
  app.get(
    '/hosts/:id/metrics/disk-space',
    validateParams(hostIdParamsSchema),
    getHostDiskSpace,
  );
  app.get(
    '/hosts/:id/metrics/temperature',
    validateParams(hostIdParamsSchema),
    validateQuery(hostMetricsRangeQuerySchema),
    getHostTemperatureMetrics,
  );
  app.get(
    '/pods/:namespace/:pod/metrics/cpu',
    validateParams(podMetricsParamsSchema),
    validateQuery(podMetricsRangeQuerySchema),
    getPodCpuMetrics,
  );
  app.get(
    '/pods/:namespace/:pod/metrics/memory',
    validateParams(podMetricsParamsSchema),
    validateQuery(podMetricsRangeQuerySchema),
    getPodMemoryMetrics,
  );
  app.patch(
    '/hosts/:id',
    validateParams(hostIdParamsSchema),
    validateBody(updateHostBodySchema),
    updateHost,
  );
  app.delete('/hosts/:id', validateParams(hostIdParamsSchema), deleteHost);

  app.get('/backup-sources', listBackupSources);
  app.post(
    '/backup-sources',
    validateBody(createBackupSourceBodySchema),
    createBackupSource,
  );
  app.post(
    '/backup-sources/:id/discovery-jobs',
    validateParams(sourceIdParamsSchema),
    validateBody(createDiscoveryJobBodySchema),
    createDiscoveryJob,
  );
  app.get(
    '/backup-sources/:id/discovery-jobs',
    validateParams(sourceIdParamsSchema),
    listSourceJobs,
  );
  app.get(
    '/backup-sources/:id/queue-items',
    validateParams(sourceIdParamsSchema),
    validateQuery(queueItemListQuerySchema),
    listSourceQueueItems,
  );
  app.get(
    '/discovery-jobs/:id',
    validateParams(jobIdParamsSchema),
    getDiscoveryJob,
  );
  app.post(
    '/discovery-jobs/:id/complete',
    validateParams(jobIdParamsSchema),
    completeDiscoveryJob,
  );
  app.post(
    '/discovery-jobs/:id/cancel',
    validateParams(jobIdParamsSchema),
    cancelDiscoveryJob,
  );
  app.post(
    '/discovery-jobs/:id/fail',
    validateParams(jobIdParamsSchema),
    validateBody(failDiscoveryJobBodySchema),
    failDiscoveryJob,
  );
  app.post(
    '/discovery-jobs/:id/queue-items',
    validateParams(jobIdParamsSchema),
    validateBody(enqueueQueueItemsBodySchema),
    enqueueQueueItems,
  );
  app.post(
    '/discovery-jobs/:id/queue-items/claim',
    validateParams(jobIdParamsSchema),
    validateBody(claimQueueItemBodySchema),
    claimQueueItem,
  );
  app.post(
    '/queue-items/:id/heartbeat',
    validateParams(queueItemIdParamsSchema),
    validateBody(heartbeatQueueItemBodySchema),
    heartbeatQueueItem,
  );
  app.post(
    '/queue-items/:id/complete',
    validateParams(queueItemIdParamsSchema),
    validateBody(completeQueueItemBodySchema),
    completeQueueItem,
  );
  app.post(
    '/queue-items/:id/fail',
    validateParams(queueItemIdParamsSchema),
    validateBody(failQueueItemBodySchema),
    failQueueItem,
  );
  app.post(
    '/queue-items/:id/skip',
    validateParams(queueItemIdParamsSchema),
    validateBody(skipQueueItemBodySchema),
    skipQueueItem,
  );
  app.post(
    '/queue-items/:id/retry',
    validateParams(queueItemIdParamsSchema),
    retryQueueItem,
  );

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`homelab-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
  });
};
