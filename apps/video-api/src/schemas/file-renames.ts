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

export const listFileRenamesQuerySchema = z.object({
  status: z.enum(FILE_RENAME_STATUSES).optional(),
});

export type ListFileRenamesQuery = z.infer<typeof listFileRenamesQuerySchema>;

export const deleteFileRenamesQuerySchema = z.object({
  season: z.coerce.number().int().positive(),
});

export type DeleteFileRenamesQuery = z.infer<
  typeof deleteFileRenamesQuerySchema
>;
