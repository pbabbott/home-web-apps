import { validationErrorResponse } from '../common';
import {
  conflictResponse,
  discoveryNotFoundResponse,
  inventoryItemWithCreatedSchema,
} from './common';
import {
  listSourceInventoryItemsOperation,
  recordInventoryItemsOperation,
} from '../../controllers/discovery/inventory-items';
import {
  inventoryItemListQuerySchema,
  queueItemIdParamsSchema,
  recordInventoryItemsBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';
import { inventoryItemSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';

export const inventoryItemsPaths = {
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
