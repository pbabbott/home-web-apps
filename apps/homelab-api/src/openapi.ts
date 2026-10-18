import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import {
  sourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  inventoryItemSelectSchema,
} from '@abbottland/homelab-db';
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
import {
  createHostOperation,
  deleteHostOperation,
  getHostOperation,
  getHostCpuMetricsOperation,
  getHostDiskIoMetricsOperation,
  getHostDiskSpaceOperation,
  getHostMemoryMetricsOperation,
  getHostTemperatureMetricsOperation,
  listHostsOperation,
  updateHostOperation,
} from './controllers/hosts';
import { getMapOperation } from './controllers/maps';
import {
  getPodCpuMetricsOperation,
  getPodMemoryMetricsOperation,
} from './controllers/pod-metrics';
import {
  createSourceOperation,
  listSourcesOperation,
} from './controllers/discovery/sources';
import {
  createDiscoveryJobOperation,
  listSourceJobsOperation,
  listDiscoveryJobsOperation,
  getDiscoveryJobOperation,
  completeDiscoveryJobOperation,
  cancelDiscoveryJobOperation,
  failDiscoveryJobOperation,
} from './controllers/discovery/discovery-jobs';
import {
  recordInventoryItemsOperation,
  listSourceInventoryItemsOperation,
} from './controllers/discovery/inventory-items';
import {
  listSourceQueueItemsOperation,
  listJobQueueItemsOperation,
  enqueueQueueItemsOperation,
  claimQueueItemOperation,
  heartbeatQueueItemOperation,
  completeQueueItemOperation,
  failQueueItemOperation,
  skipQueueItemOperation,
  retryQueueItemOperation,
} from './controllers/discovery/queue-items';
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
  exporterType: z.enum(['node_exporter', 'windows_exporter']),
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

const conflictSchema = z.object({
  message: z
    .string()
    .meta({ example: 'job still has queued or in-progress work' }),
});

const conflictResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: conflictSchema } },
});

const discoveryNotFoundResponse = (what: string) => ({
  description: `No ${what} exists with this id`,
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: `${what} not found` }),
      }),
    },
  },
});

const queueCountsSchema = z
  .object({
    queued: z.number(),
    in_progress: z.number(),
    completed: z.number(),
    failed: z.number(),
    skipped: z.number(),
  })
  .meta({
    description:
      'This job’s item counts by status. failed > 0 on a completed job means it finished with failures.',
  });

const discoveryJobResponseSchema = discoveryJobSelectSchema.extend({
  queueCounts: queueCountsSchema,
});

const queueItemWithCreatedSchema = discoveryQueueItemSelectSchema.extend({
  created: z.boolean().meta({
    description: 'false if this path was already queued for the job.',
  }),
});

const inventoryItemWithCreatedSchema = inventoryItemSelectSchema.extend({
  created: z.boolean().meta({
    description: 'false if this path was already recorded for the source.',
  }),
});

const claimResultSchema = z
  .object({
    item: discoveryQueueItemSelectSchema.nullable().meta({
      description: 'The claimed item, or null if nothing is claimable.',
    }),
    reason: z
      .enum(['queue_empty', 'retry_backoff', 'in_progress'])
      .optional()
      .meta({
        description:
          'Present when item is null. queue_empty: nothing queued or in progress, so the job can be completed. retry_backoff: queued items are waiting out a retry delay. in_progress: only other workers’ leases remain.',
      }),
    retryAt: z.string().nullable().optional().meta({
      format: 'date-time',
      description:
        'Present when item is null. When it is worth claiming again (null for queue_empty).',
    }),
    queueCounts: queueCountsSchema.optional(),
  })
  .meta({ id: 'ClaimResult' });

const completedQueueItemSchema = discoveryQueueItemSelectSchema.extend({
  children: z.array(queueItemWithCreatedSchema),
});

const discoveryJobWithSourceSchema = discoveryJobSelectSchema.extend({
  sourceName: z.string(),
  hostId: z.uuid().nullable().meta({
    description: 'The host the job’s source is linked to, if any.',
  }),
});

const discoveryPaths = {
  '/sources': {
    get: {
      summary: listSourcesOperation.summary,
      responses: {
        '200': {
          description: 'The sources',
          content: {
            'application/json': { schema: z.array(sourceSelectSchema) },
          },
        },
      },
    },
    post: {
      summary: createSourceOperation.summary,
      requestBody: {
        content: {
          'application/json': { schema: createSourceBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The created source',
          content: {
            'application/json': { schema: sourceSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '409': conflictResponse('A source with this name already exists'),
      },
    },
  },
  '/sources/{id}/discovery-jobs': {
    get: {
      summary: listSourceJobsOperation.summary,
      description: listSourceJobsOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      responses: {
        '200': {
          description: 'The jobs',
          content: {
            'application/json': { schema: z.array(discoveryJobSelectSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
    post: {
      summary: createDiscoveryJobOperation.summary,
      description: createDiscoveryJobOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: createDiscoveryJobBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The pending job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
        '409': conflictResponse('The source already has an active job'),
      },
    },
  },
  '/sources/{id}/queue-items': {
    get: {
      summary: listSourceQueueItemsOperation.summary,
      description: listSourceQueueItemsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: queueItemListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The queue items',
          content: {
            'application/json': {
              schema: z.array(discoveryQueueItemSelectSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/sources/{id}/inventory-items': {
    get: {
      summary: listSourceInventoryItemsOperation.summary,
      description: listSourceInventoryItemsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: inventoryItemListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The inventory items',
          content: {
            'application/json': {
              schema: z.array(inventoryItemSelectSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/discovery-jobs': {
    get: {
      summary: listDiscoveryJobsOperation.summary,
      description: listDiscoveryJobsOperation.description,
      requestParams: { query: jobListQuerySchema },
      responses: {
        '200': {
          description: 'The jobs',
          content: {
            'application/json': {
              schema: z.array(discoveryJobWithSourceSchema),
            },
          },
        },
        '400': validationErrorResponse,
      },
    },
  },
  '/discovery-jobs/{id}': {
    get: {
      summary: getDiscoveryJobOperation.summary,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
      },
    },
  },
  '/discovery-jobs/{id}/complete': {
    post: {
      summary: completeDiscoveryJobOperation.summary,
      description: completeDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The completed job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('Work remains, or the job is already finished'),
      },
    },
  },
  '/discovery-jobs/{id}/cancel': {
    post: {
      summary: cancelDiscoveryJobOperation.summary,
      description: cancelDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The cancelled job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
  '/discovery-jobs/{id}/fail': {
    post: {
      summary: failDiscoveryJobOperation.summary,
      description: failDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: failDiscoveryJobBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The failed job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
  '/discovery-jobs/{id}/queue-items': {
    get: {
      summary: listJobQueueItemsOperation.summary,
      description: listJobQueueItemsOperation.description,
      requestParams: {
        path: jobIdParamsSchema,
        query: jobQueueItemListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The queue items',
          content: {
            'application/json': {
              schema: z.array(discoveryQueueItemSelectSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
      },
    },
    post: {
      summary: enqueueQueueItemsOperation.summary,
      description: enqueueQueueItemsOperation.description,
      requestParams: { path: jobIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: enqueueQueueItemsBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'One entry per distinct requested path',
          content: {
            'application/json': {
              schema: z.array(queueItemWithCreatedSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse(
          'The job is finished, or a path is outside the job root',
        ),
      },
    },
  },
  '/discovery-jobs/{id}/queue-items/claim': {
    post: {
      summary: claimQueueItemOperation.summary,
      description: claimQueueItemOperation.description,
      requestParams: { path: jobIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: claimQueueItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The claimed item, or why there is nothing to claim',
          content: {
            'application/json': { schema: claimResultSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is finished'),
      },
    },
  },
  '/queue-items/{id}/heartbeat': {
    post: {
      summary: heartbeatQueueItemOperation.summary,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: heartbeatQueueItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The item with its new lease',
          content: {
            'application/json': { schema: discoveryQueueItemSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Wrong token, lease expired, or not in progress',
        ),
      },
    },
  },
  '/queue-items/{id}/inventory-items': {
    post: {
      summary: recordInventoryItemsOperation.summary,
      description: recordInventoryItemsOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: recordInventoryItemsBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The recorded items',
          content: {
            'application/json': {
              schema: z.array(inventoryItemWithCreatedSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Lost claim, or a path is outside the claimed directory',
        ),
      },
    },
  },
  '/queue-items/{id}/complete': {
    post: {
      summary: completeQueueItemOperation.summary,
      description: completeQueueItemOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: completeQueueItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The completed item and its enqueued children',
          content: {
            'application/json': { schema: completedQueueItemSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Lost claim, or a discovered path is outside the job root',
        ),
      },
    },
  },
  '/queue-items/{id}/fail': {
    post: {
      summary: failQueueItemOperation.summary,
      description: failQueueItemOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: failQueueItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The item (queued again, or failed)',
          content: {
            'application/json': { schema: discoveryQueueItemSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Wrong token, lease expired, or not in progress',
        ),
      },
    },
  },
  '/queue-items/{id}/skip': {
    post: {
      summary: skipQueueItemOperation.summary,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: skipQueueItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The skipped item',
          content: {
            'application/json': { schema: discoveryQueueItemSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Wrong token, lease expired, or not in progress',
        ),
      },
    },
  },
  '/queue-items/{id}/retry': {
    post: {
      summary: retryQueueItemOperation.summary,
      description: retryQueueItemOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      responses: {
        '200': {
          description: 'The requeued item',
          content: {
            'application/json': { schema: discoveryQueueItemSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'Only failed items can be retried, and only while their job is active',
        ),
      },
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
    ...discoveryPaths,
    '/hosts': {
      get: {
        summary: listHostsOperation.summary,
        description: listHostsOperation.description,
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
        summary: createHostOperation.summary,
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
        summary: getHostOperation.summary,
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
        summary: updateHostOperation.summary,
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
        summary: deleteHostOperation.summary,
        requestParams: { path: hostIdParamsSchema },
        responses: {
          '204': { description: 'The host was deleted' },
          '400': validationErrorResponse,
          '404': notFoundResponse,
          '409': conflictResponse('The host is still referenced by a source'),
        },
      },
    },
    '/hosts/{id}/metrics/cpu': {
      get: {
        summary: getHostCpuMetricsOperation.summary,
        description: getHostCpuMetricsOperation.description,
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
        summary: getHostMemoryMetricsOperation.summary,
        description: getHostMemoryMetricsOperation.description,
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
        summary: getHostDiskIoMetricsOperation.summary,
        description: getHostDiskIoMetricsOperation.description,
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
        summary: getHostDiskSpaceOperation.summary,
        description: getHostDiskSpaceOperation.description,
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
        summary: getHostTemperatureMetricsOperation.summary,
        description: getHostTemperatureMetricsOperation.description,
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
