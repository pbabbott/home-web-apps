import { z } from 'zod';

const shareMappingSchema = z.object({
  pathPrefix: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .meta({ example: 'C:\\Users', description: 'Windows path prefix.' }),
  share: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[^\\/:;"]+$/, 'share name must not contain \\ / : ; "')
    .meta({
      example: 'Users',
      description: 'SMB share that serves the prefix.',
    }),
});

export const connectionSettingsSchema = z.object({
  shareMappings: z.array(shareMappingSchema).max(20).optional().meta({
    description:
      'Which share serves which path. Without a match a drive path uses its administrative share (C:\\ -> C$).',
  }),
});

export const saveSourceConnectionBodySchema = z.object({
  connectionType: z.enum(['smb']),
  username: z.string().trim().min(1).max(200),
  domain: z.string().trim().min(1).max(200).nullish(),
  password: z.string().min(1).max(500).optional().meta({
    description:
      'Required when creating a connection. Omit when editing to keep the stored password.',
  }),
  settings: connectionSettingsSchema.optional(),
});
export type SaveSourceConnectionBody = z.infer<
  typeof saveSourceConnectionBodySchema
>;

export const previewQuerySchema = z.object({
  path: z.string().min(1).max(1000).meta({
    example: 'C:\\Users\\you\\Pictures\\photo.jpg',
    description:
      'A file inside an inventory item of the source, or a path skipped during discovery.',
  }),
});
export type PreviewQuery = z.infer<typeof previewQuerySchema>;
