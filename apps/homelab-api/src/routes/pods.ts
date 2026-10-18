import { Router } from 'express';
import { validateParams, validateQuery } from '@abbottland/express';
import {
  getPodCpuMetrics,
  getPodMemoryMetrics,
} from '../controllers/pod-metrics';
import {
  podMetricsParamsSchema,
  podMetricsRangeQuerySchema,
} from '../schemas/pods';

export const podsRouter = Router();

podsRouter.get(
  '/pods/:namespace/:pod/metrics/cpu',
  validateParams(podMetricsParamsSchema),
  validateQuery(podMetricsRangeQuerySchema),
  getPodCpuMetrics,
);
podsRouter.get(
  '/pods/:namespace/:pod/metrics/memory',
  validateParams(podMetricsParamsSchema),
  validateQuery(podMetricsRangeQuerySchema),
  getPodMemoryMetrics,
);
