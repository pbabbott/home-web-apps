import { z } from 'zod';

const serverSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[A-Za-z0-9._:-]+$/, 'must be a host name or address')
  .meta({ example: '192.168.4.124' });

const exportPathSchema = z
  .string()
  .trim()
  .min(2)
  .max(500)
  .refine((p) => p.startsWith('/'), { message: 'must be an absolute path' })
  .refine((p) => !p.includes('\0') && !p.split('/').includes('..'), {
    message: 'must not contain NUL or .. segments',
  })
  .meta({ example: '/volume1/Dump' });

const settingsSchema = z.object({
  server: serverSchema,
  exportPath: exportPathSchema,
});

/** Relative folder under the mount; blank means the mount root (null). */
const rootDirSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (p) =>
      !p.startsWith('/') &&
      !p.includes('\0') &&
      !p.includes('\\') &&
      !p.split('/').includes('..'),
    { message: 'must be relative, with no .. segments or backslashes' },
  )
  .transform((p) => p.replace(/^\.?\/+|\/+$/g, '') || null)
  .nullable()
  .meta({
    description:
      'Optional folder under the mount where Exodus writes. Blank or null means the mount root.',
  });

export const createBackupDestinationBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  connectionType: z.literal('nfs').default('nfs'),
  settings: settingsSchema.meta({
    description:
      'The expected identity of the mount. Where it is mounted comes from the worker’s environment.',
  }),
  rootDir: rootDirSchema.optional(),
  enabled: z.boolean().default(true),
});
export type CreateBackupDestinationBody = z.infer<
  typeof createBackupDestinationBodySchema
>;

export const updateBackupDestinationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    settings: settingsSchema.optional(),
    rootDir: rootDirSchema.optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.settings !== undefined ||
      body.rootDir !== undefined,
    { message: 'provide name, settings and/or rootDir' },
  );
export type UpdateBackupDestinationBody = z.infer<
  typeof updateBackupDestinationBodySchema
>;
