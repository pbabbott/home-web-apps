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
