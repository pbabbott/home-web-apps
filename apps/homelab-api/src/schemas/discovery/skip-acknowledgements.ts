import { z } from 'zod';
import { windowsPathSchema } from './common';

export const skipAcknowledgementBodySchema = z.object({
  path: windowsPathSchema.meta({
    description:
      'The skipped path, inside the queue item’s directory. For a pattern skip, the directory the pattern was skipped in.',
  }),
  pattern: z.string().trim().min(1).max(260).optional().meta({
    description:
      'Set for a “skipped by pattern” entry (e.g. `*.msi`); `path` is then the queue item’s directory.',
  }),
});
export type SkipAcknowledgementBody = z.infer<
  typeof skipAcknowledgementBodySchema
>;

export const skipAcknowledgementListQuerySchema = z.object({
  pathPrefix: windowsPathSchema.optional().meta({
    description: 'Only acknowledgements at or beneath this path.',
  }),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type SkipAcknowledgementListQuery = z.infer<
  typeof skipAcknowledgementListQuerySchema
>;
