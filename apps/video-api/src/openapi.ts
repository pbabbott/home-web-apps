import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import { videoJobSelectSchema } from '@abbottland/video-db';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';
import { browseQuerySchema } from './schemas/browse';

const validationErrorSchema = z.object({
  message: z.string().meta({ example: 'Invalid request body' }),
  errors: z.array(
    z.object({
      field: z.string().meta({ example: 'inputPath' }),
      message: z.string().meta({ example: 'inputPath is required' }),
    }),
  ),
});

const validationErrorResponse = {
  description: 'One or more fields are missing or invalid',
  content: {
    'application/json': { schema: validationErrorSchema },
  },
};

const browseEntrySchema = z.object({
  name: z.string(),
  type: z.enum(['directory', 'file']),
});

/**
 * Generated from the Zod schemas that already validate these routes'
 * requests (src/schemas/*.ts) and from video-db's videoJobSelectSchema
 * (itself derived from the video_jobs table) — so this can't drift from
 * what the API actually accepts/returns the way a hand-written spec can.
 */
export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'video-api',
    version: '0.1.0',
    description:
      'Queues video-processing jobs (Postgres-backed) for a separate video-worker.',
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
    '/readyz': {
      get: {
        summary: 'Readiness check',
        description: 'Confirms PostgreSQL is reachable.',
        responses: {
          '200': {
            description: 'Postgres is reachable',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
          '503': {
            description: 'Postgres is unreachable',
            content: {
              'application/json': {
                schema: z.object({
                  status: z.literal('error'),
                  message: z.string(),
                }),
              },
            },
          },
        },
      },
    },
    '/jobs': {
      get: {
        summary: 'List jobs, optionally filtered by status',
        requestParams: { query: listJobsQuerySchema },
        responses: {
          '200': {
            description: 'Matching jobs, most recently created first',
            content: {
              'application/json': {
                schema: z.object({ jobs: z.array(videoJobSelectSchema) }),
              },
            },
          },
          '400': validationErrorResponse,
        },
      },
      post: {
        summary: 'Create a video-processing job',
        requestBody: {
          content: { 'application/json': { schema: createJobSchema } },
        },
        responses: {
          '201': {
            description: 'Job created',
            content: {
              'application/json': {
                schema: z.object({
                  jobId: z.uuid(),
                  status: z.literal('pending'),
                }),
              },
            },
          },
          '400': validationErrorResponse,
        },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Fetch a job status/result',
        requestParams: { path: jobIdParamsSchema },
        responses: {
          '200': {
            description: 'The job record',
            content: { 'application/json': { schema: videoJobSelectSchema } },
          },
          '400': validationErrorResponse,
          '404': { description: 'No job with that id' },
        },
      },
    },
    '/browse': {
      get: {
        summary: 'List files/folders under MEDIA_ROOT',
        description:
          'path is resolved relative to, and constrained within, MEDIA_ROOT. Requests that attempt to traverse outside of it get a 400.',
        requestParams: { query: browseQuerySchema },
        responses: {
          '200': {
            description: 'Directory listing',
            content: {
              'application/json': {
                schema: z.object({
                  path: z.string(),
                  entries: z.array(browseEntrySchema),
                }),
              },
            },
          },
          '400': {
            description: 'path escapes MEDIA_ROOT or is not a directory',
          },
          '404': { description: 'path does not exist' },
        },
      },
    },
  },
});
