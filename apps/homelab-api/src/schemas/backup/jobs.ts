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

const jobStatusSchema = z.enum([
  'planned',
  'running',
  'completed',
  'completed_with_issues',
  'failed',
  'cancelled',
]);

export const backupJobListQuerySchema = z.object({
  sourceId: z.uuid().optional(),
  destinationId: z.uuid().optional(),
  status: jobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type BackupJobListQuery = z.infer<typeof backupJobListQuerySchema>;

export const jobIdParamsSchema = idParamsSchema;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;

export const failBackupJobBodySchema = z.object({
  error: z.string().trim().min(1).max(1000).meta({
    example: 'the source machine is being reinstalled',
  }),
});
export type FailBackupJobBody = z.infer<typeof failBackupJobBodySchema>;

export const backupJobItemStatusSchema = z.enum([
  'queued',
  'in_progress',
  'verified',
  'failed',
  'blocked',
  'skipped',
  'excluded',
]);

export const backupJobItemListQuerySchema = z.object({
  status: backupJobItemStatusSchema.optional(),
  after: z.string().min(1).optional().meta({
    description: 'Cursor: the `next` value of the previous page.',
  }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type BackupJobItemListQuery = z.infer<
  typeof backupJobItemListQuerySchema
>;

export const backupEntryListQuerySchema = z.object({
  status: z.enum(['pending', 'verified', 'failed', 'not_followed']).optional(),
  issueKind: z
    .enum([
      'read_failed',
      'unlistable',
      'source_missing',
      'name_too_long',
      'unsupported_path',
      'verify_mismatch',
      'write_failed',
      'dest_conflict',
      'reparse_point_not_followed',
      'kept_both',
    ])
    .optional(),
  after: z.coerce.number().int().min(0).optional().meta({
    description: 'Cursor: the `next` value of the previous page.',
  }),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});
export type BackupEntryListQuery = z.infer<typeof backupEntryListQuerySchema>;
