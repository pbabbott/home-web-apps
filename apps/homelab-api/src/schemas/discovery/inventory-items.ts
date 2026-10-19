import { z } from 'zod';
import { claimTokenSchema, windowsPathSchema } from './common';

// Kept small so a worst-case batch (260-char paths) stays under the shared
// Express json() body limit of 100kb.
export const MAX_INVENTORY_ITEMS_PER_REQUEST = 200;

export const recordInventoryItemsBodySchema = z.object({
  claimToken: claimTokenSchema,
  items: z
    .array(
      z.object({
        path: windowsPathSchema.meta({
          description:
            'Absolute path of a file or directory inside the claimed directory.',
        }),
        itemType: z.enum(['file', 'directory']),
        sizeBytes: z
          .number()
          .int()
          .min(0)
          .max(Number.MAX_SAFE_INTEGER)
          .optional(),
        modifiedAt: z.iso.datetime({ offset: true }).optional().meta({
          description: 'Last-modified time on the source machine.',
        }),
      }),
    )
    .min(1)
    .max(MAX_INVENTORY_ITEMS_PER_REQUEST),
});
export type RecordInventoryItemsBody = z.infer<
  typeof recordInventoryItemsBodySchema
>;

export const inventoryItemListQuerySchema = z.object({
  jobId: z.uuid().optional().meta({
    description: 'Only items last seen by this job.',
  }),
  itemType: z.enum(['file', 'directory']).optional(),
  reviewDisposition: z
    .enum(['candidate', 'not_needed', 'needs_review'])
    .optional(),
  parentPath: windowsPathSchema.optional().meta({
    description: 'Only direct children of this directory.',
  }),
  pathPrefix: windowsPathSchema.optional().meta({
    description: 'Only items at or beneath this path prefix.',
  }),
  after: z.string().min(1).optional().meta({
    description:
      'Cursor: the normalizedPath of the last item of the previous page.',
  }),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type InventoryItemListQuery = z.infer<
  typeof inventoryItemListQuerySchema
>;

export const MAX_REVIEW_ITEMS_PER_REQUEST = 200;

export const inventoryItemIdParamsSchema = z.object({ id: z.uuid() });
export type InventoryItemIdParams = z.infer<typeof inventoryItemIdParamsSchema>;

const reviewDispositionSchema = z.enum([
  'candidate',
  'not_needed',
  'needs_review',
]);

export const reviewInventoryItemBodySchema = z.object({
  disposition: reviewDispositionSchema,
  note: z.string().trim().min(1).max(1000).nullable().optional().meta({
    description:
      'Replaces the note; null clears it. When omitted the note is kept if the disposition is unchanged and cleared if it changes.',
  }),
});
export type ReviewInventoryItemBody = z.infer<
  typeof reviewInventoryItemBodySchema
>;

export const reviewInventoryItemsBodySchema =
  reviewInventoryItemBodySchema.extend({
    ids: z.array(z.uuid()).min(1).max(MAX_REVIEW_ITEMS_PER_REQUEST),
  });
export type ReviewInventoryItemsBody = z.infer<
  typeof reviewInventoryItemsBodySchema
>;
