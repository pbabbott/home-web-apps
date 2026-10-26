import { z } from 'zod';
import { inventoryItemSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
  exclusionResolutionSchema,
} from './common';
import {
  decideInventoryItemOperation,
  getInventoryItemOperation,
  inventoryDirectoryOperation,
  listInventoryItemsOperation,
  promoteInventoryItemOperation,
  proposeInventoryItemsOperation,
} from '../../controllers/discovery/inventory-items';
import {
  inventoryItemEvidenceSchema,
  decideInventoryItemBodySchema,
  inventoryDirectoryBodySchema,
  promoteInventoryItemBodySchema,
  proposeInventoryItemsBodySchema,
  queueItemIdParamsSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

// The stored evidence is typed in homelab-db; document the shape the API
// validates instead of the generic JSON the select schema derives.
const inventoryItemSchema = inventoryItemSelectSchema.extend({
  evidence: inventoryItemEvidenceSchema,
});

const nestedInventoryItemSchema = inventoryItemSchema
  .pick({
    id: true,
    kind: true,
    rootPath: true,
    displayName: true,
    recommendation: true,
    decision: true,
  })
  .meta({
    description:
      'An existing inventory item overlapping the proposed path, with its human decision.',
  });

const upsertedInventoryItemSchema = inventoryItemSchema.extend({
  coveredBy: z.array(nestedInventoryItemSchema).meta({
    description:
      'Existing inventory items whose root is an ancestor of this one (nearest last). Informational: nothing is inherited.',
  }),
  covers: z.array(nestedInventoryItemSchema).meta({
    description:
      'Existing inventory items beneath this one, ordered by path, at most 50.',
  }),
  created: z.boolean().meta({
    description: 'true if this proposal created the inventory item.',
  }),
  changed: z.boolean().meta({
    description:
      'true if an existing inventory item’s recommendation, evidence or other agent fields changed.',
  }),
});

const inventoriedDirectorySchema = z.object({
  inventoryItem: inventoryItemSchema,
  created: z.boolean().meta({
    description: 'false when the agent had already proposed the directory.',
  }),
  skippedQueueItems: z.number().int().meta({
    description:
      'Queued items of the active job skipped now because they sit inside the directory.',
  }),
  coveredBy: z.array(nestedInventoryItemSchema),
  covers: z.array(nestedInventoryItemSchema),
});

const inventoryItemWithExclusionSchema = inventoryItemSchema.extend({
  exclusion: exclusionResolutionSchema,
});

export const inventoryItemsPaths = {
  '/queue-items/{id}/inventory-items': {
    post: {
      summary: proposeInventoryItemsOperation.summary,
      'x-mcp-tool': proposeInventoryItemsOperation.mcp.name,
      description: proposeInventoryItemsOperation.description,
      requestParams: { path: queueItemIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: proposeInventoryItemsBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The inventory items, in request order',
          content: {
            'application/json': {
              schema: z.array(upsertedInventoryItemSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'The claim is no longer valid, a path is outside the claimed directory, or a path is covered by an exclusion rule',
        ),
      },
    },
  },
  '/sources/{id}/inventory-items': {
    get: {
      summary: listInventoryItemsOperation.summary,
      'x-home-hud': listInventoryItemsOperation.hud,
      'x-mcp-tool': listInventoryItemsOperation.mcp.name,
      description: listInventoryItemsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: inventoryItemListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The inventory items',
          content: {
            'application/json': { schema: z.array(inventoryItemSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
  '/inventory-items/{id}': {
    get: {
      summary: getInventoryItemOperation.summary,
      'x-home-hud': getInventoryItemOperation.hud,
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
  '/inventory-items/{id}/decision': {
    patch: {
      summary: decideInventoryItemOperation.summary,
      'x-home-hud': decideInventoryItemOperation.hud,
      description: decideInventoryItemOperation.description,
      requestParams: {
        path: inventoryItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: decideInventoryItemBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The decided inventory item',
          content: { 'application/json': { schema: inventoryItemSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('inventory item'),
        '409': conflictResponse(
          'The actor is not a human, or the path is covered by an exclusion rule and cannot be approved',
        ),
      },
    },
  },
  '/queue-items/{id}/inventory-directory': {
    post: {
      summary: inventoryDirectoryOperation.summary,
      'x-home-hud': inventoryDirectoryOperation.hud,
      description: inventoryDirectoryOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: inventoryDirectoryBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The approved directory inventory item',
          content: {
            'application/json': { schema: inventoriedDirectorySchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'The actor is not a human, an exclusion rule covers the path, or the path is a file inventory item',
        ),
      },
    },
  },
  '/queue-items/{id}/promote': {
    post: {
      summary: promoteInventoryItemOperation.summary,
      'x-home-hud': promoteInventoryItemOperation.hud,
      description: promoteInventoryItemOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: promoteInventoryItemBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The new, approved inventory item',
          content: { 'application/json': { schema: inventoryItemSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'The actor is not a human, the path already has an inventory item, is under an exclusion rule, or is outside the queue item’s directory',
        ),
      },
    },
  },
};
