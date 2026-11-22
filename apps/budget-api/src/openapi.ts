import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import {
  budgetJobSelectSchema,
  ynabSyncStateSelectSchema,
} from '@abbottland/budget-db';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  listRawResponsesQuerySchema,
} from './schemas/jobs';

const validationErrorSchema = z.object({
  message: z.string().meta({ example: 'Invalid request body' }),
  errors: z.array(
    z.object({
      field: z.string().meta({ example: 'parameters.name' }),
      message: z.string().meta({ example: 'Invalid input: expected string' }),
    }),
  ),
});

const validationErrorResponse = {
  description: 'One or more fields are missing or invalid',
  content: {
    'application/json': { schema: validationErrorSchema },
  },
};

/**
 * Generated from the Zod schemas that already validate these routes'
 * requests (src/schemas/*.ts) and from budget-db's budgetJobSelectSchema
 * (itself derived from the budget_jobs table), so it can't drift from what
 * the API actually accepts/returns.
 */
export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'budget-api',
    version: '0.1.0',
    description:
      'Queues budget jobs (Postgres-backed) for a separate budget-worker.',
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
        description:
          'Confirms PostgreSQL is reachable and the schema is at least as new as this build expects.',
        responses: {
          '200': {
            description: 'Postgres is reachable and the schema is current',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
          '503': {
            description:
              'Postgres is unreachable, or the schema is behind/unverifiable',
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
                schema: z.object({ jobs: z.array(budgetJobSelectSchema) }),
              },
            },
          },
          '400': validationErrorResponse,
        },
      },
      post: {
        summary: 'Create a budget job',
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
    '/ynab/sync-state': {
      get: {
        summary: 'YNAB delta cursors per plan and endpoint',
        description:
          'The server_knowledge each (plan, endpoint) has been synced up to, and when. Raw payloads are not exposed.',
        responses: {
          '200': {
            description: 'Current cursors',
            content: {
              'application/json': {
                schema: z.object({
                  syncState: z.array(ynabSyncStateSelectSchema),
                }),
              },
            },
          },
        },
      },
    },
    '/ynab/plans': {
      get: {
        summary: 'YNAB plan ids and names',
        description:
          'Read from the latest stored plans response; only id and name are extracted.',
        responses: {
          '200': {
            description: 'Plans the token can see',
            content: {
              'application/json': {
                schema: z.object({
                  plans: z.array(
                    z.object({ id: z.string(), name: z.string() }),
                  ),
                }),
              },
            },
          },
        },
      },
    },
    '/ynab/sync-runs': {
      get: {
        summary: 'One summary row per sync run, newest first',
        responses: {
          '200': {
            description: 'Sync runs with snapshot/delta counts and total size',
            content: {
              'application/json': {
                schema: z.object({
                  syncRuns: z.array(
                    z.object({
                      jobId: z.uuid().nullable(),
                      startedAt: z.string().meta({ format: 'date-time' }),
                      responses: z.number(),
                      snapshots: z.number(),
                      deltas: z.number(),
                      totalBytes: z.number(),
                    }),
                  ),
                }),
              },
            },
          },
        },
      },
    },
    '/ynab/raw-responses': {
      get: {
        summary: 'Metadata for stored raw YNAB responses (no payloads)',
        description:
          'Newest first. Payloads hold personal financial data and are never returned; this reports size, cursors and timing only.',
        requestParams: { query: listRawResponsesQuerySchema },
        responses: {
          '200': {
            description: 'Matching raw response summaries',
            content: {
              'application/json': {
                schema: z.object({
                  rawResponses: z.array(
                    z.object({
                      id: z.uuid(),
                      jobId: z.uuid().nullable(),
                      planId: z.string().nullable(),
                      endpoint: z.string(),
                      serverKnowledgeRequested: z.number().nullable(),
                      serverKnowledgeReturned: z.number().nullable(),
                      httpStatus: z.number(),
                      payloadBytes: z.number(),
                      payloadSha256: z.string(),
                      fetchedAt: z.string().meta({ format: 'date-time' }),
                    }),
                  ),
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
            content: { 'application/json': { schema: budgetJobSelectSchema } },
          },
          '400': validationErrorResponse,
          '404': { description: 'No job with that id' },
        },
      },
    },
  },
});
