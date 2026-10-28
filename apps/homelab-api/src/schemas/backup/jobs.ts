import { z } from 'zod';
import { windowsPathSchema } from '../discovery/common';
import { idParamsSchema } from './common';

export const sourceIdParamsSchema = idParamsSchema;
export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

export const planBackupJobBodySchema = z.object({
  destinationId: z.uuid(),
  inventoryItemIds: z.array(z.uuid()).max(1000).optional().meta({
    description:
      'Only these inventory items. Omit for every item of the source.',
  }),
  pathPrefix: windowsPathSchema.optional().meta({
    description: 'Only items at or beneath this path.',
  }),
  kinds: z.array(z.enum(['file', 'directory'])).optional(),
  skipAlreadyCovered: z.boolean().default(true).meta({
    description:
      'Skip items already verified at this destination (`skipped`, `already_covered`).',
  }),
});
export type PlanBackupJobBody = z.infer<typeof planBackupJobBodySchema>;
