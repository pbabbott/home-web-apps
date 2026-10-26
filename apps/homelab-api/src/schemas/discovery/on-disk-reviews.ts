import { z } from 'zod';
import { windowsPathSchema } from './common';

export const onDiskReviewListQuerySchema = z.object({
  pathPrefix: windowsPathSchema.optional().meta({
    description: 'Only reviews at or beneath this path.',
  }),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type OnDiskReviewListQuery = z.infer<typeof onDiskReviewListQuerySchema>;
