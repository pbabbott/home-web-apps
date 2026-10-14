import { z } from 'zod';
import { createDocument } from 'zod-openapi';
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
  model3d: z.string().nullable(),
  createdAt: z.string().meta({ format: 'date-time' }),
  status: z.enum(['online', 'offline', 'unknown']),
  cpuUsageRatio: z.number().nullable(),
});

const hostCpuSeriesSchema = z.object({
  cpu: z.string().meta({ example: '0' }),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({ description: '0-1 busy ratio for this core' }),
    }),
  ),
});

const hostCpuResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostCpuSeriesSchema),
});

const hostMemorySeriesSchema = z.object({
  component: z.enum(['used', 'buffers', 'cached', 'free']),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({ description: 'Bytes' }),
    }),
  ),
});

const hostMemoryResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostMemorySeriesSchema),
});

const hostDiskIoSeriesSchema = z.object({
  device: z.string().meta({ example: 'sda' }),
  component: z.enum(['read', 'written', 'ioTime']),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({
        description: 'Bytes/sec for read/written, 0-1 busy ratio for ioTime',
      }),
    }),
  ),
});

const hostDiskIoResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostDiskIoSeriesSchema),
});

const hostDiskMountpointSchema = z.object({
  mountpoint: z.string().meta({ example: '/' }),
  sizeBytes: z.number(),
  availableBytes: z.number(),
  usedBytes: z.number(),
  usedRatio: z.number(),
});

const hostDiskSpaceResponseSchema = z.object({
  instance: z.string().nullable(),
  mountpoints: z.array(hostDiskMountpointSchema),
});

const hostTemperatureSeriesSchema = z.object({
  label: z.string().meta({ example: 'Package id 0' }),
  chip: z.string().meta({ example: 'platform_coretemp_0' }),
  sensor: z.string().meta({ example: 'temp1' }),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({ description: 'Degrees Celsius' }),
    }),
  ),
});

const hostTemperatureResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostTemperatureSeriesSchema),
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

const podNotFoundResponse = {
  description: 'No pod exists with this namespace/name',
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: 'pod not found' }),
      }),
    },
  },
};

const podContainerSeriesSchema = z.object({
  container: z.string().meta({ example: 'blog' }),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number(),
    }),
  ),
});

const podCpuResponseSchema = z.object({
  stepSeconds: z.number(),
  series: z.array(podContainerSeriesSchema).meta({
    description: 'Per-container CPU usage history, in cores.',
  }),
  requestCores: z.number().nullable(),
  limitCores: z.number().nullable(),
});

const podMemoryResponseSchema = z.object({
  stepSeconds: z.number(),
  series: z.array(podContainerSeriesSchema).meta({
    description: 'Per-container working-set memory history, in bytes.',
  }),
  requestBytes: z.number().nullable(),
  limitBytes: z.number().nullable(),
});

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
    '/pods/{namespace}/{pod}/metrics/cpu': {
      get: {
        summary: 'Per-container CPU usage history for a single pod',
        description:
          'One series per container, in cores, plus the pod’s declared requestCores/limitCores (summed across containers) for drawing reference lines. 404 if the pod does not exist.',
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
        summary:
          'Per-container working-set memory usage history for a single pod',
        description:
          'One series per container, in bytes, plus the pod’s declared requestBytes/limitBytes (summed across containers) for drawing reference lines. 404 if the pod does not exist.',
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
      patch: {
        summary: 'Update a host',
        requestParams: { path: hostIdParamsSchema },
        requestBody: {
          content: { 'application/json': { schema: updateHostBodySchema } },
        },
        responses: {
          '200': {
            description: 'The updated host',
            content: { 'application/json': { schema: hostResponseSchema } },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
      delete: {
        summary: 'Delete a host',
        requestParams: { path: hostIdParamsSchema },
        responses: {
          '204': { description: 'The host was deleted' },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/hosts/{id}/metrics/cpu': {
      get: {
        summary: 'Per-CPU usage history for a single host',
        description:
          'One series per CPU core (e.g. 4 series for a 4-core host), each core’s busy ratio normalized by core count. A host with no instance set returns an empty series rather than 404/500.',
        requestParams: {
          path: hostIdParamsSchema,
          query: hostMetricsRangeQuerySchema,
        },
        responses: {
          '200': {
            description: 'The CPU history',
            content: {
              'application/json': { schema: hostCpuResponseSchema },
            },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/hosts/{id}/metrics/memory': {
      get: {
        summary: 'Memory breakdown history for a single host',
        description:
          'Four series in bytes: used (total − free − buffers − cached), buffers, cached, free. A host with no instance set returns an empty series rather than 404/500.',
        requestParams: {
          path: hostIdParamsSchema,
          query: hostMetricsRangeQuerySchema,
        },
        responses: {
          '200': {
            description: 'The memory history',
            content: {
              'application/json': { schema: hostMemoryResponseSchema },
            },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/hosts/{id}/metrics/disk-io': {
      get: {
        summary: 'Per-device disk I/O history for a single host',
        description:
          'Three series per real block device (excludes loop/partition devices): read bytes/sec, written bytes/sec, io time (0-1 busy ratio). A host with no instance set returns an empty series rather than 404/500.',
        requestParams: {
          path: hostIdParamsSchema,
          query: hostMetricsRangeQuerySchema,
        },
        responses: {
          '200': {
            description: 'The disk I/O history',
            content: {
              'application/json': { schema: hostDiskIoResponseSchema },
            },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/hosts/{id}/metrics/disk-space': {
      get: {
        summary: 'Current filesystem usage per mountpoint for a single host',
        description:
          'An instant snapshot (not a time range) of size/used/available per mountpoint. A host with no instance set returns an empty list rather than 404/500.',
        requestParams: { path: hostIdParamsSchema },
        responses: {
          '200': {
            description: 'The disk space snapshot',
            content: {
              'application/json': { schema: hostDiskSpaceResponseSchema },
            },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
    '/hosts/{id}/metrics/temperature': {
      get: {
        summary: 'Per-sensor temperature history for a single host',
        description:
          'Only ever populated for physical hosts — standalone node-exporter targets expose hwmon sensors; in-cluster k8s nodes (VMs) do not. A host with no instance, or no hwmon sensors, returns an empty series rather than 404/500.',
        requestParams: {
          path: hostIdParamsSchema,
          query: hostMetricsRangeQuerySchema,
        },
        responses: {
          '200': {
            description: 'The temperature history',
            content: {
              'application/json': { schema: hostTemperatureResponseSchema },
            },
          },
          '400': validationErrorResponse,
          '404': notFoundResponse,
        },
      },
    },
  },
});
