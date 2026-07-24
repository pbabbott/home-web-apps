import { z } from 'zod';
import type { FileRenameStatus } from '@abbottland/video-db';

// Type-only import above keeps this in sync with video-db's status enum at
// compile time, without a runtime dependency on the module (which would
// otherwise break under jest.mock('@abbottland/video-db') in tests).
const FILE_RENAME_STATUSES: readonly FileRenameStatus[] = [
  'pending',
  'applied',
  'rejected',
];

export const createFileRenameSchema = z.object({
  originalFilePath: z.string().min(1, 'originalFilePath is required').meta({
    description: 'Path to the video file, relative to MEDIA_ROOT',
    example: '/tv_shows/Show A/S01E01.mp4',
  }),
  suggestedFilePath: z.string().min(1, 'suggestedFilePath is required').meta({
    description:
      'AI-suggested destination path, relative to MEDIA_ROOT. Nothing renames the file automatically — this just records the suggestion.',
    example: '/tv_shows/Show A/S01E01 - Pups Save a Toof.mp4',
  }),
});

export type CreateFileRenameBody = z.infer<typeof createFileRenameSchema>;

export const fileRenameIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listFileRenamesQuerySchema = z.object({
  fileHash: z.string().min(1).optional().meta({
    description: 'Look up by a previously-returned fileHash directly',
  }),
  filePath: z.string().min(1).optional().meta({
    description:
      'Look up by the original path instead — resolved and hashed the same way POST does',
    example: '/tv_shows/Show A/S01E01.mp4',
  }),
  status: z.enum(FILE_RENAME_STATUSES).optional(),
});

export type ListFileRenamesQuery = z.infer<typeof listFileRenamesQuerySchema>;

export const updateFileRenameStatusSchema = z.object({
  status: z.enum(FILE_RENAME_STATUSES).meta({
    description:
      'Mark the outcome of the suggestion. applied stamps appliedAt with the current time; rejected or pending clear it.',
    example: 'applied',
  }),
});

export type UpdateFileRenameStatusBody = z.infer<
  typeof updateFileRenameStatusSchema
>;
