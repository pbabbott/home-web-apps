import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
  inventoryItemWithCreatedSchema,
} from './common';
import {
  getInventoryItemOperation,
  listSourceInventoryItemsOperation,
  recordInventoryItemsOperation,
  reviewInventoryItemOperation,
  reviewInventoryItemsOperation,
} from '../../controllers/discovery/inventory-items';
import {
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  queueItemIdParamsSchema,
  recordInventoryItemsBodySchema,
  reviewInventoryItemBodySchema,
  reviewInventoryItemsBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';
import { inventoryItemSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';

const exclusionResolutionSchema = z.object({
  state: z.enum(['none', 'selective', 'excluded']),
  ruleIds: z.array(z.uuid()).meta({
    description: 'The rules that decided the state.',
  }),
});

const inventoryItemWithExclusionSchema = inventoryItemSelectSchema.extend({
  exclusion: exclusionResolutionSchema,
});

const bulkReviewResultSchema = z.object({
  changedCount: z.number(),
  unchangedCount: z.number(),
  items: z.array(inventoryItemSelectSchema),
});

export const inventoryItemsPaths = {
  '/inventory-items/review': {
    post: {
      summary: reviewInventoryItemsOperation.summary,
      description: reviewInventoryItemsOperation.description,
      requestParams: { header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: reviewInventoryItemsBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The reviewed items',
          content: {
            'application/json': { schema: bulkReviewResultSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('inventory item'),
        '409': conflictResponse(
          'Some items are covered by exclusion rules and cannot be candidates',
        ),
      },
    },
  },
  '/inventory-items/{id}': {
    get: {
      summary: getInventoryItemOperation.summary,
      description: getInventoryItemOperation.description,
      requestParams: { path: inventoryItemIdParamsSchema },
      responses: {
        '200': {
          description: 'The inventory item',
          content: {
            'application/json': { schema: inventoryItemWithExclusionSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('inventory item'),
      },
    },
  },
  '/inventory-items/{id}/review': {
    patch: {
      summary: reviewInventoryItemOperation.summary,
      description: reviewInventoryItemOperation.description,
      requestParams: {
        path: inventoryItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: reviewInventoryItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The reviewed item',
          content: {
            'application/json': { schema: inventoryItemSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('inventory item'),
        '409': conflictResponse(
          'The item is covered by an exclusion rule and cannot be a candidate',
        ),
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
};
