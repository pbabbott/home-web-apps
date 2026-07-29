import { z } from 'zod';

export const listTitleCardsQuerySchema = z.object({
  fileHash: z.string().optional(),
});

export type ListTitleCardsQuery = z.infer<typeof listTitleCardsQuerySchema>;
