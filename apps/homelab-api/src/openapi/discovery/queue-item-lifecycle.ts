import { validationErrorResponse } from '../common';
import {
  claimResultSchema,
  completedQueueItemSchema,
  conflictResponse,
  discoveryNotFoundResponse,
  queueItemListEntrySchema,
} from './common';
import {
  claimAnyQueueItemOperation,
  claimQueueItemOperation,
  completeQueueItemOperation,
  failQueueItemOperation,
  heartbeatQueueItemOperation,
  releaseQueueItemOperation,
  retryFailedQueueItemsOperation,
  retryQueueItemOperation,
  skipQueueItemOperation,
} from '../../controllers/discovery/queue-items';
import {
  claimAnyQueueItemBodySchema,
  claimQueueItemBodySchema,
  completeQueueItemBodySchema,
  failQueueItemBodySchema,
  heartbeatQueueItemBodySchema,
  jobIdParamsSchema,
  queueItemIdParamsSchema,
  releaseQueueItemBodySchema,
  skipQueueItemBodySchema,
} from '../../schemas/discovery';
import { discoveryQueueItemSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';

export const queueItemLifecyclePaths = {
  '/queue-items/claim': {
    post: {
      summary: claimAnyQueueItemOperation.summary,
      'x-mcp-tool': claimAnyQueueItemOperation.mcp.name,
      description: claimAnyQueueItemOperation.description,
      requestBody: {
        content: {
          'application/json': { schema: claimAnyQueueItemBodySchema },
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
  '/queue-items/{id}/release': {
    post: {
      summary: releaseQueueItemOperation.summary,
      'x-mcp-tool': releaseQueueItemOperation.mcp.name,
      description: releaseQueueItemOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: releaseQueueItemBodySchema },
        },
      },
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
          'Wrong token, lease expired, or not in progress',
        ),
      },
    },
  },
  '/discovery-jobs/{id}/retry-failed': {
    post: {
      summary: retryFailedQueueItemsOperation.summary,
      'x-home-hud': retryFailedQueueItemsOperation.hud,
      description: retryFailedQueueItemsOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The requeued items',
          content: {
            'application/json': {
              schema: z.array(queueItemListEntrySchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is finished'),
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
