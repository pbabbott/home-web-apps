import { validationErrorResponse } from './common';
import {
  getPodCpuMetricsOperation,
  getPodMemoryMetricsOperation,
} from '../controllers/pod-metrics';
import {
  podMetricsParamsSchema,
  podMetricsRangeQuerySchema,
} from '../schemas/pods';
import { z } from 'zod';

export const podNotFoundResponse = {
  description: 'No pod exists with this namespace/name',
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: 'pod not found' }),
      }),
    },
  },
};

export const podContainerSeriesSchema = z.object({
  container: z.string().meta({ example: 'blog' }),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number(),
    }),
  ),
});

export const podCpuResponseSchema = z.object({
  stepSeconds: z.number(),
  series: z.array(podContainerSeriesSchema).meta({
    description: 'Per-container CPU usage history, in cores.',
  }),
  requestCores: z.number().nullable(),
  limitCores: z.number().nullable(),
});

export const podMemoryResponseSchema = z.object({
  stepSeconds: z.number(),
  series: z.array(podContainerSeriesSchema).meta({
    description: 'Per-container working-set memory history, in bytes.',
  }),
  requestBytes: z.number().nullable(),
  limitBytes: z.number().nullable(),
});

export const podsPaths = {
  '/pods/{namespace}/{pod}/metrics/cpu': {
    get: {
      summary: getPodCpuMetricsOperation.summary,
      description: getPodCpuMetricsOperation.description,
      requestParams: {
        path: podMetricsParamsSchema,
        query: podMetricsRangeQuerySchema,
      },
      responses: {
        '200': {
          description: 'The CPU history',
          content: { 'application/json': { schema: podCpuResponseSchema } },
        },
        '400': validationErrorResponse,
        '404': podNotFoundResponse,
      },
    },
  },
  '/pods/{namespace}/{pod}/metrics/memory': {
    get: {
      summary: getPodMemoryMetricsOperation.summary,
      description: getPodMemoryMetricsOperation.description,
      requestParams: {
        path: podMetricsParamsSchema,
        query: podMetricsRangeQuerySchema,
      },
      responses: {
        '200': {
          description: 'The memory history',
          content: {
            'application/json': { schema: podMemoryResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': podNotFoundResponse,
      },
    },
  },
};
