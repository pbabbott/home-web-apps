import { validationErrorResponse } from '../common';
import {
  conflictResponse,
  discoveryNotFoundResponse,
  jobQueueItemListEntrySchema,
  queueItemDetailSchema,
  queueItemListEntrySchema,
  queueItemWithCreatedSchema,
} from './common';
import {
  enqueueQueueItemsOperation,
  getDirectoryListingOperation,
  getQueueItemOperation,
  listJobQueueItemsOperation,
  listKnownSkipsOperation,
  listSkippedGroupMatchesOperation,
  listSourceQueueItemsOperation,
} from '../../controllers/discovery/queue-items';
import {
  enqueueQueueItemsBodySchema,
  jobIdParamsSchema,
  jobQueueItemListQuerySchema,
  knownSkipListQuerySchema,
  queueItemIdParamsSchema,
  queueItemListQuerySchema,
  skippedGroupMatchesQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';
import { z } from 'zod';

const knownSkipSchema = z.object({
  path: z.string(),
  reason: z.string(),
  pattern: z.string().optional().meta({
    description:
      'Present for a pattern skip: it covers matching direct children of `path`, a directory.',
  }),
  count: z.number().optional(),
  skippedAt: z.string().meta({ format: 'date-time' }),
  jobId: z.uuid().meta({ description: 'The job that recorded the skip.' }),
});

const skippedGroupMatchesSchema = z.object({
  path: z.string().meta({ description: 'The queue item’s directory.' }),
  pattern: z.string(),
  total: z
    .number()
    .int()
    .meta({ description: 'Matches found, before the cap.' }),
  truncated: z.boolean(),
  entries: z.array(
    z.object({
      name: z.string(),
      path: z.string().meta({ description: 'Full path, usable for preview.' }),
      isDirectory: z.boolean(),
      size: z.number(),
      modifiedAt: z.string().nullable(),
    }),
  ),
});

const coverageSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('inventory'),
      decision: z.enum(['pending', 'approved', 'rejected']),
      recommendation: z.enum(['back_up', 'skip', 'needs_review']),
    }),
    z.object({ kind: z.literal('inventory_parent') }),
    z.object({
      kind: z.literal('skipped'),
      via: z.enum(['path', 'pattern']),
      pattern: z.string().optional(),
      acknowledged: z.boolean(),
    }),
    z.object({
      kind: z.literal('queued'),
      status: z.enum([
        'queued',
        'in_progress',
        'completed',
        'failed',
        'skipped',
      ]),
    }),
    z.object({ kind: z.literal('excluded') }),
    z.object({
      kind: z.literal('inventory_inside'),
      count: z.number().int(),
    }),
    z.object({ kind: z.literal('uncovered') }),
  ])
  .meta({
    description:
      'How the entry is accounted for. inventory_parent: an inventory item at the directory or above covers it. queued: the job gave it a queue item of its own. inventory_inside: a directory with inventory items deeper down but none of its own. uncovered: nothing accounts for it.',
  });

const directoryListingSchema = z.object({
  path: z.string().meta({ description: 'The queue item’s directory.' }),
  total: z
    .number()
    .int()
    .meta({ description: 'Entries found, before the cap.' }),
  truncated: z.boolean(),
  uncovered: z.number().int().meta({
    description: 'Entries whose coverage is `uncovered`.',
  }),
  entries: z.array(
    z.object({
      name: z.string(),
      path: z.string().meta({ description: 'Full path, usable for preview.' }),
      isDirectory: z.boolean(),
      size: z.number(),
      modifiedAt: z.string().nullable(),
      coverage: coverageSchema,
    }),
  ),
});

const messageResponse = (description: string) => ({
  description,
  content: {
    'application/json': { schema: z.object({ message: z.string() }) },
  },
});

export const queueItemsPaths = {
  '/queue-items/{id}/directory-listing': {
    get: {
      summary: getDirectoryListingOperation.summary,
      'x-home-hud': getDirectoryListingOperation.hud,
      description: getDirectoryListingOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      responses: {
        '200': {
          description: 'The directory’s entries with their coverage',
          content: {
            'application/json': { schema: directoryListingSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse(
          'queue item, source connection or directory',
        ),
        '409': conflictResponse('The source is not linked to a host'),
        '502': messageResponse('The source could not be read'),
        '503': messageResponse('EXODUS_CREDENTIAL_KEY is not configured'),
      },
    },
  },
  '/queue-items/{id}': {
    get: {
      summary: getQueueItemOperation.summary,
      'x-home-hud': getQueueItemOperation.hud,
      description: getQueueItemOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      responses: {
        '200': {
          description: 'The queue item',
          content: { 'application/json': { schema: queueItemDetailSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
      },
    },
  },
  '/queue-items/{id}/skipped-group-matches': {
    get: {
      summary: listSkippedGroupMatchesOperation.summary,
      'x-home-hud': listSkippedGroupMatchesOperation.hud,
      description: listSkippedGroupMatchesOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        query: skippedGroupMatchesQuerySchema,
      },
      responses: {
        '200': {
          description: 'The matching entries',
          content: {
            'application/json': { schema: skippedGroupMatchesSchema },
          },
        },
        '400': validationErrorResponse,
        '403': messageResponse('The pattern is not recorded on the item'),
        '404': discoveryNotFoundResponse(
          'queue item, source connection or directory',
        ),
        '409': conflictResponse('The source is not linked to a host'),
        '502': messageResponse('The source could not be read'),
        '503': messageResponse('EXODUS_CREDENTIAL_KEY is not configured'),
      },
    },
  },
  '/sources/{id}/known-skips': {
    get: {
      summary: listKnownSkipsOperation.summary,
      'x-mcp-tool': listKnownSkipsOperation.mcp.name,
      description: listKnownSkipsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: knownSkipListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The skipped paths, newest reason per path',
          content: {
            'application/json': { schema: z.array(knownSkipSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/sources/{id}/queue-items': {
    get: {
      summary: listSourceQueueItemsOperation.summary,
      'x-home-hud': listSourceQueueItemsOperation.hud,
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
              schema: z.array(queueItemListEntrySchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/discovery-jobs/{id}/queue-items': {
    get: {
      summary: listJobQueueItemsOperation.summary,
      'x-home-hud': listJobQueueItemsOperation.hud,
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
              schema: z.array(jobQueueItemListEntrySchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
      },
    },
    post: {
      summary: enqueueQueueItemsOperation.summary,
      'x-home-hud': enqueueQueueItemsOperation.hud,
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
};
