import { z } from 'zod';

export const hashQuerySchema = z.object({
  filePath: z.string().min(1, 'filePath is required').meta({
    description: 'Path to the video file, relative to MEDIA_ROOT',
    example: '/tv_shows/Show A/S01E01.mp4',
  }),
});

export type HashQuery = z.infer<typeof hashQuerySchema>;
