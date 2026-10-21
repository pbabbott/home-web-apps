import { validationErrorResponse } from '../common';
import {
  claimResultSchema,
  completedQueueItemSchema,
  conflictResponse,
  discoveryNotFoundResponse,
  queueItemWithCreatedSchema,
} from './common';
import {
  claimQueueItemOperation,
  completeQueueItemOperation,
  enqueueQueueItemsOperation,
  failQueueItemOperation,
  heartbeatQueueItemOperation,
  listJobQueueItemsOperation,
  listKnownSkipsOperation,
  listSourceQueueItemsOperation,
  retryQueueItemOperation,
  skipQueueItemOperation,
} from '../../controllers/discovery/queue-items';
import {
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  enqueueQueueItemsBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  jobQueueItemListQuerySchema,
  knownSkipListQuerySchema,
  queueItemIdParamsSchema,
  queueItemListQuerySchema,
  skipQueueItemBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';
import { discoveryQueueItemSelectSchema } from '@abbottland/homelab-db';
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

export const queueItemsPaths = {
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
              schema: z.array(discoveryQueueItemSelectSchema),
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
  '/discovery-jobs/{id}/queue-items/claim': {
    post: {
      summary: claimQueueItemOperation.summary,
      'x-mcp-tool': claimQueueItemOperation.mcp.name,
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
      'x-mcp-tool': heartbeatQueueItemOperation.mcp.name,
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
  '/queue-items/{id}/complete': {
    post: {
      summary: completeQueueItemOperation.summary,
      'x-mcp-tool': completeQueueItemOperation.mcp.name,
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
      'x-mcp-tool': failQueueItemOperation.mcp.name,
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
      'x-mcp-tool': skipQueueItemOperation.mcp.name,
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
      'x-home-hud': retryQueueItemOperation.hud,
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
