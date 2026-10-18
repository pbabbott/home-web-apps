import { validationErrorResponse } from './common';
import { getMapOperation } from '../controllers/maps';
import { mapQuerySchema, mapTypeParamsSchema } from '../schemas/maps';
import { z } from 'zod';

export const hexStatusSchema = z.enum([
  'healthy',
  'warning',
  'error',
  'unknown',
]);

export const metricStatSchema = z.object({
  usage: z.number().nullable(),
  request: z.number().nullable(),
  limit: z.number().nullable(),
  ratio: z.number().nullable(),
  status: hexStatusSchema,
});

export const restartStatSchema = z.object({
  count: z.number(),
  maxCount: z.number(),
  ratio: z.number(),
  status: hexStatusSchema,
});

export const podMapItemSchema = z.object({
  id: z.string().meta({ example: 'blog/blog-7495dbf5ff-znq59' }),
  label: z.string().meta({ example: 'blog-7495dbf5ff-znq59' }),
  status: hexStatusSchema,
  namespace: z.string(),
  node: z.string().nullable(),
  workload: z.object({ kind: z.string(), name: z.string() }).nullable(),
  phase: z.string().nullable(),
  restarts: z.number(),
  containers: z.array(z.string()),
  age: z.string().nullable(),
  metrics: z.object({
    cpu: metricStatSchema,
    memory: metricStatSchema,
    restarts: restartStatSchema,
  }),
});

export const podMapGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  dimension: z.enum(['namespace', 'node', 'workload']),
  itemIds: z.array(z.string()),
});

export const mapResponseSchema = z.object({
  mapType: z.literal('pods'),
  metric: z.enum(['cpu', 'memory', 'both', 'restarts']),
  items: z.array(podMapItemSchema),
  groups: z.array(podMapGroupSchema).nullable(),
});

export const mapsPaths = {
  '/maps/{type}': {
    get: {
      summary: getMapOperation.summary,
      description: getMapOperation.description,
      requestParams: {
        path: mapTypeParamsSchema,
        query: mapQuerySchema,
      },
      responses: {
        '200': {
          description: 'The status map',
          content: { 'application/json': { schema: mapResponseSchema } },
        },
        '400': validationErrorResponse,
      },
    },
  },
};
