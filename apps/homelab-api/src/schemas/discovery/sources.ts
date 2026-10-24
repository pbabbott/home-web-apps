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
export const updateSourceBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .optional()
      .meta({ example: 'win11-desktop' }),
    hostId: z.uuid().nullable().optional().meta({
      description:
        'Id of the registered host this source lives on; null unlinks it. Omit to leave it unchanged.',
    }),
  })
  .refine((body) => body.name !== undefined || body.hostId !== undefined, {
    message: 'Provide a name or a hostId to change',
  });
export type UpdateSourceBody = z.infer<typeof updateSourceBodySchema>;

export type CreateSourceBody = z.infer<typeof createSourceBodySchema>;
