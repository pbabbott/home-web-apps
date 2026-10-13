import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import { mapQuerySchema, mapTypeParamsSchema } from './schemas/maps';
import {
  createHostBodySchema,
  hostIdParamsSchema,
  hostListQuerySchema,
} from './schemas/hosts';

const validationErrorSchema = z.object({
  message: z.string().meta({ example: 'Invalid query parameters' }),
  errors: z.array(
    z.object({
      field: z.string().meta({ example: 'metric' }),
      message: z.string().meta({
        example: 'Invalid option: expected one of "cpu"|"memory"|"both"',
      }),
    }),
  ),
});

const validationErrorResponse = {
  description: 'One or more fields are missing or invalid',
  content: {
    'application/json': { schema: validationErrorSchema },
  },
};

const hexStatusSchema = z.enum(['healthy', 'warning', 'error', 'unknown']);

const metricStatSchema = z.object({
  usage: z.number().nullable(),
  request: z.number().nullable(),
  limit: z.number().nullable(),
  ratio: z.number().nullable(),
  status: hexStatusSchema,
});

const restartStatSchema = z.object({
  count: z.number(),
  maxCount: z.number(),
  ratio: z.number(),
  status: hexStatusSchema,
});

const podMapItemSchema = z.object({
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

const podMapGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  dimension: z.enum(['namespace', 'node', 'workload']),
  itemIds: z.array(z.string()),
});

const mapResponseSchema = z.object({
  mapType: z.literal('pods'),
  metric: z.enum(['cpu', 'memory', 'both', 'restarts']),
  items: z.array(podMapItemSchema),
  groups: z.array(podMapGroupSchema).nullable(),
});

const hostResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  hostType: z.enum(['physical', 'virtual']),
  ipAddress: z.string(),
  instance: z.string().nullable(),
  createdAt: z.string().meta({ format: 'date-time' }),
  status: z.enum(['online', 'offline', 'unknown']),
  cpuUsageRatio: z.number().nullable(),
});

const notFoundResponse = {
  description: 'No host exists with this id',
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: 'host not found' }),
      }),
    },
  },
};

/**
 * Generated from the Zod schemas that already validate /maps/:type's
 * request (src/schemas/maps.ts) so this can't drift from what the API
 * actually accepts. The response shape is hand-described since it's built
 * from live Kubernetes/Prometheus data rather than a stored schema.
 */
export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'homelab-api',
    version: '0.1.0',
    description:
      'Reads Kubernetes resources and enriches them with Prometheus metrics for the home-hud infra map.',
  },
  paths: {
    '/healthz': {
      get: {
        summary: 'Liveness check',
        responses: {
          '200': {
            description: 'Process is up',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
        },
      },
    },
    '/maps/{type}': {
      get: {
        summary: 'Fetch a status map for a Kubernetes resource type',
        description:
          'Today only type=pods is supported. Each item status is driven by the requested metric: cpu/memory/both use usage ÷ limit (falling back to request, then node-relative capacity); restarts is relative to the worst pod in this response (fewer than 10 restarts is always healthy). Pass groupBy to have items pre-grouped by namespace/node/workload.',
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
    '/hosts': {
      get: {
        summary: 'List registered hosts, enriched with live Prometheus data',
        description:
          'status/cpuUsageRatio are best-effort: a host with no instance, or whose node-exporter data has not reached Prometheus, still returns with status="unknown" rather than failing the request.',
        requestParams: { query: hostListQuerySchema },
        responses: {
          '200': {
            description: 'The host list',
            content: {
              'application/json': { schema: z.array(hostResponseSchema) },
            },
          },
          '400': validationErrorResponse,
        },
      },
      post: {
        summary: 'Register a new host',
        requestBody: {
          content: { 'application/json': { schema: createHostBodySchema } },
        },
        responses: {
          '201': {
            description: 'The created host',
            content: { 'application/json': { schema: hostResponseSchema } },
          },
          '400': validationErrorResponse,
        },
      },
    },
    '/hosts/{id}': {
      get: {
        summary: 'Fetch a single host, enriched with live Prometheus data',
        requestParams: { path: hostIdParamsSchema },
        responses: {
          '200': {
            description: 'The host',
            content: { 'application/json': { schema: hostResponseSchema } },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
  },
});
