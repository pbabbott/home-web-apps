import express, { type Express, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
import { createSource, listSources } from './controllers/discovery/sources';
import {
  cancelDiscoveryJob,
  completeDiscoveryJob,
  createDiscoveryJob,
  failDiscoveryJob,
  getDiscoveryJob,
  listDiscoveryJobs,
  listSourceJobs,
} from './controllers/discovery/discovery-jobs';
import {
  claimQueueItem,
  completeQueueItem,
  enqueueQueueItems,
  failQueueItem,
  heartbeatQueueItem,
  listJobQueueItems,
  listSourceQueueItems,
  retryQueueItem,
  skipQueueItem,
} from './controllers/discovery/queue-items';
import {
  listSourceInventoryItems,
  recordInventoryItems,
} from './controllers/discovery/inventory-items';
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
import { createMcpServer } from './mcp';
import { openApiSpec } from './openapi';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  createSourceBodySchema,
  createDiscoveryJobBodySchema,
  enqueueQueueItemsBodySchema,
  failDiscoveryJobBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  inventoryItemListQuerySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
  jobQueueItemListQuerySchema,
  queueItemIdParamsSchema,
  queueItemListQuerySchema,
  recordInventoryItemsBodySchema,
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
export const MCP_ROUTE = '/mcp';

// Mirrors the JSON-RPC error shape the MCP SDK itself returns for
// unsupported methods (see StreamableHTTPServerTransport#handleUnsupportedRequest).
const methodNotAllowed = (_req: Request, res: Response) => {
  res.set('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
};

// Stateless MCP handler: a fresh McpServer + transport per request, no session
// store, so it works across replicas without sticky sessions. GET/DELETE are
// rejected since there is no session to stream to or close.
const handleMcpRequest = async (req: Request, res: Response) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};

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

  app.get('/sources', listSources);
  app.post('/sources', validateBody(createSourceBodySchema), createSource);
  app.post(
    '/sources/:id/discovery-jobs',
    validateParams(sourceIdParamsSchema),
    validateBody(createDiscoveryJobBodySchema),
    createDiscoveryJob,
  );
  app.get(
    '/sources/:id/discovery-jobs',
    validateParams(sourceIdParamsSchema),
    listSourceJobs,
  );
  app.get(
    '/sources/:id/queue-items',
    validateParams(sourceIdParamsSchema),
    validateQuery(queueItemListQuerySchema),
    listSourceQueueItems,
  );
  app.get(
    '/sources/:id/inventory-items',
    validateParams(sourceIdParamsSchema),
    validateQuery(inventoryItemListQuerySchema),
    listSourceInventoryItems,
  );
  app.get(
    '/discovery-jobs/:id/queue-items',
    validateParams(jobIdParamsSchema),
    validateQuery(jobQueueItemListQuerySchema),
    listJobQueueItems,
  );
  app.get(
    '/discovery-jobs',
    validateQuery(jobListQuerySchema),
    listDiscoveryJobs,
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
    '/queue-items/:id/inventory-items',
    validateParams(queueItemIdParamsSchema),
    validateBody(recordInventoryItemsBodySchema),
    recordInventoryItems,
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

  app
    .post(MCP_ROUTE, handleMcpRequest)
    .get(MCP_ROUTE, methodNotAllowed)
    .delete(MCP_ROUTE, methodNotAllowed);

  configureErrorHandler(app);

  return app;
};

export const startServer = () => {
  const port = config.port;

  const server = createServer();

  server.listen(port, () => {
    console.log(`homelab-api running on ${port}`);
    console.log(`📚 Swagger docs: http://localhost:${port}${DOCS_ROUTE}`);
    console.log(`🔌 MCP endpoint: http://localhost:${port}${MCP_ROUTE}`);
  });
};
