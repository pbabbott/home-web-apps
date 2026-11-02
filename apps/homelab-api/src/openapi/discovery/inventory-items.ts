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
  pathCoverageOperation,
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
  pathCoverageQuerySchema,
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

const pathCoverageSchema = z.object({
  path: z.string(),
  normalizedPath: z.string(),
  status: z.enum(['covered', 'carved_out', 'rejected', 'pending', 'uncovered']),
  decidingItem: nestedInventoryItemSchema.nullable().meta({
    description:
      'The item that decided the status; the nearest item when pending.',
  }),
  exact: nestedInventoryItemSchema.nullable().meta({
    description: 'The inventory item at exactly this path.',
  }),
  coveredBy: z.array(nestedInventoryItemSchema).meta({
    description:
      'Inventory items whose root is a proper ancestor, farthest first.',
  }),
  covers: z.array(nestedInventoryItemSchema).meta({
    description: 'Inventory items beneath the path, at most 50.',
  }),
  exclusion: exclusionResolutionSchema,
  skip: z
    .object({
      path: z.string(),
      reason: z.string(),
      skippedAt: z.iso.datetime(),
      jobId: z.uuid(),
      pattern: z.string().optional(),
      count: z.number().int().optional(),
    })
    .nullable()
    .meta({ description: 'The deepest agent skip at or above the path.' }),
  visitedDirectory: z
    .object({
      id: z.uuid(),
      jobId: z.uuid(),
      path: z.string(),
      status: z.string(),
    })
    .nullable()
    .meta({
      description:
        'The deepest queue item (any job) at or above the path; a path can be promoted from it.',
    }),
});

export const inventoryItemsPaths = {
  '/sources/{id}/path-coverage': {
    get: {
      summary: pathCoverageOperation.summary,
      'x-home-hud': pathCoverageOperation.hud,
      description: pathCoverageOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: pathCoverageQuerySchema,
      },
      responses: {
        '200': {
          description: 'How the inventory covers the path',
          content: { 'application/json': { schema: pathCoverageSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
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
            'application/json': {
              schema: z.object({
                items: z.array(inventoryItemSchema),
                total: z.number().int().meta({
                  description:
                    'Every inventory item matching the filters, ignoring paging.',
                }),
              }),
            },
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
