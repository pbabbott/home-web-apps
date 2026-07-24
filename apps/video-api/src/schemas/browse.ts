import { z } from 'zod';

export const browseQuerySchema = z.object({
  path: z.string().optional().meta({
    description:
      'Path to list, relative to MEDIA_ROOT. Defaults to the root itself.',
    example: 'tv_shows',
  }),
});

export type BrowseQuery = z.infer<typeof browseQuerySchema>;
