import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
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
} from '../controllers/hosts';
import {
  createHostBodySchema,
  hostIdParamsSchema,
  hostListQuerySchema,
  hostMetricsRangeQuerySchema,
  updateHostBodySchema,
} from '../schemas/hosts';

export const hostsRouter = Router();

hostsRouter.get('/hosts', validateQuery(hostListQuerySchema), listHosts);
hostsRouter.post('/hosts', validateBody(createHostBodySchema), createHost);
hostsRouter.get('/hosts/:id', validateParams(hostIdParamsSchema), getHost);
hostsRouter.get(
  '/hosts/:id/metrics/cpu',
  validateParams(hostIdParamsSchema),
  validateQuery(hostMetricsRangeQuerySchema),
  getHostCpuMetrics,
);
hostsRouter.get(
  '/hosts/:id/metrics/memory',
  validateParams(hostIdParamsSchema),
  validateQuery(hostMetricsRangeQuerySchema),
  getHostMemoryMetrics,
);
hostsRouter.get(
  '/hosts/:id/metrics/disk-io',
  validateParams(hostIdParamsSchema),
  validateQuery(hostMetricsRangeQuerySchema),
  getHostDiskIoMetrics,
);
hostsRouter.get(
  '/hosts/:id/metrics/disk-space',
  validateParams(hostIdParamsSchema),
  getHostDiskSpace,
);
hostsRouter.get(
  '/hosts/:id/metrics/temperature',
  validateParams(hostIdParamsSchema),
  validateQuery(hostMetricsRangeQuerySchema),
  getHostTemperatureMetrics,
);
hostsRouter.patch(
  '/hosts/:id',
  validateParams(hostIdParamsSchema),
  validateBody(updateHostBodySchema),
  updateHost,
);
hostsRouter.delete(
  '/hosts/:id',
  validateParams(hostIdParamsSchema),
  deleteHost,
);
