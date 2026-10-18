import { validationErrorResponse } from './common';
import { conflictResponse } from './discovery/common';
import {
  createHostOperation,
  deleteHostOperation,
  getHostCpuMetricsOperation,
  getHostDiskIoMetricsOperation,
  getHostDiskSpaceOperation,
  getHostMemoryMetricsOperation,
  getHostOperation,
  getHostTemperatureMetricsOperation,
  listHostsOperation,
  updateHostOperation,
} from '../controllers/hosts';
import {
  createHostBodySchema,
  hostIdParamsSchema,
  hostListQuerySchema,
  hostMetricsRangeQuerySchema,
  updateHostBodySchema,
} from '../schemas/hosts';
import { z } from 'zod';

export const hostResponseSchema = z.object({
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

export const hostCpuSeriesSchema = z.object({
  cpu: z.string().meta({ example: '0' }),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({ description: '0-1 busy ratio for this core' }),
    }),
  ),
});

export const hostCpuResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostCpuSeriesSchema),
});

export const hostMemorySeriesSchema = z.object({
  component: z.enum(['used', 'buffers', 'cached', 'free']),
  points: z.array(
    z.object({
      t: z.number().meta({ description: 'Unix seconds', example: 1700000000 }),
      value: z.number().meta({ description: 'Bytes' }),
    }),
  ),
});

export const hostMemoryResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostMemorySeriesSchema),
});

export const hostDiskIoSeriesSchema = z.object({
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

export const hostDiskIoResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostDiskIoSeriesSchema),
});

export const hostDiskMountpointSchema = z.object({
  mountpoint: z.string().meta({ example: '/' }),
  sizeBytes: z.number(),
  availableBytes: z.number(),
  usedBytes: z.number(),
  usedRatio: z.number(),
});

export const hostDiskSpaceResponseSchema = z.object({
  instance: z.string().nullable(),
  mountpoints: z.array(hostDiskMountpointSchema),
});

export const hostTemperatureSeriesSchema = z.object({
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

export const hostTemperatureResponseSchema = z.object({
  instance: z.string().nullable(),
  stepSeconds: z.number(),
  series: z.array(hostTemperatureSeriesSchema),
});

export const notFoundResponse = {
  description: 'No host exists with this id',
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: 'host not found' }),
      }),
    },
  },
};

export const hostsPaths = {
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
};
