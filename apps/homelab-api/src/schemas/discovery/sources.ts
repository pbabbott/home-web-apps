import { z } from 'zod';

export const sourceIdParamsSchema = z.object({ id: z.uuid() });
export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

export const createSourceBodySchema = z.object({
  name: z.string().min(1).meta({ example: 'win11-desktop' }),
  hostId: z.uuid().optional().meta({
    description:
      'Id of the registered host (see /hosts) this source lives on. Omit if the machine is not registered.',
  }),
  sourceType: z.enum(['windows']).default('windows'),
});
export type CreateSourceBody = z.infer<typeof createSourceBodySchema>;
