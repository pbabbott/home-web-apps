import { z } from 'zod';

export const createTitleCardSchema = z.object({
  filePath: z.string().min(1, 'filePath is required').meta({
    description: 'Path to the video file, relative to MEDIA_ROOT',
    example: '/tv_shows/Show A/S01E01.mp4',
  }),
  timestampSeconds: z.number().int().nonnegative().meta({
    description: 'Second offset into the video where the title card appears',
    example: 128,
  }),
  title: z.string().min(1).optional().meta({
    description: 'Title text read off the card, if known',
    example: 'Pups Save a Toof',
  }),
  screenshotPath: z.string().min(1).optional().meta({
    description:
      'Path (relative to MEDIA_ROOT) of the screenshot that showed this title card, if any',
    example: '/screenshots/<jobId>/128.jpg',
  }),
});

export type CreateTitleCardBody = z.infer<typeof createTitleCardSchema>;

export const titleCardIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listTitleCardsQuerySchema = z.object({
  fileHash: z.string().min(1).optional().meta({
    description: 'Look up by a previously-returned fileHash directly',
  }),
  filePath: z.string().min(1).optional().meta({
    description:
      'Look up by path instead — resolved and hashed the same way POST does',
    example: '/tv_shows/Show A/S01E01.mp4',
  }),
});

export type ListTitleCardsQuery = z.infer<typeof listTitleCardsQuerySchema>;
