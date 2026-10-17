import { z } from 'zod';
import { normalizeWindowsPath } from '../lib/windows-path';

const isValidWindowsPath = (value: string): boolean => {
  try {
    normalizeWindowsPath(value);
    return true;
  } catch {
    return false;
  }
};

/** Validates only; services re-run normalizeWindowsPath to get the canonical form. */
const windowsPathSchema = z
  .string()
  .min(1)
  .refine(isValidWindowsPath, {
    message:
      'must be an absolute Windows path (C:\\folder or \\\\server\\share\\folder) without . or .. segments',
  })
  .meta({ example: 'C:\\Users\\You' });

export const sourceIdParamsSchema = z.object({ id: z.uuid() });
export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

export const jobIdParamsSchema = z.object({ id: z.uuid() });
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;

export const queueItemIdParamsSchema = z.object({ id: z.uuid() });
export type QueueItemIdParams = z.infer<typeof queueItemIdParamsSchema>;

export const createBackupSourceBodySchema = z.object({
  name: z.string().min(1).meta({ example: 'win11-desktop' }),
  hostId: z.uuid().optional().meta({
    description:
      'Id of the registered host (see /hosts) this source lives on. Omit if the machine is not registered.',
  }),
  sourceType: z.enum(['windows']).default('windows'),
});
export type CreateBackupSourceBody = z.infer<
  typeof createBackupSourceBodySchema
>;

export const createDiscoveryJobBodySchema = z.object({
  rootPath: windowsPathSchema.meta({
    description: 'Directory the job starts from; queued as the first item.',
  }),
});
export type CreateDiscoveryJobBody = z.infer<
  typeof createDiscoveryJobBodySchema
>;

export const failDiscoveryJobBodySchema = z.object({
  error: z.string().min(1).meta({ example: 'agent lost access to the share' }),
});
export type FailDiscoveryJobBody = z.infer<typeof failDiscoveryJobBodySchema>;

const MAX_PATHS_PER_REQUEST = 1000;

export const enqueueQueueItemsBodySchema = z.object({
  paths: z.array(windowsPathSchema).min(1).max(MAX_PATHS_PER_REQUEST),
  priority: z.number().int().default(0).meta({
    description: 'Higher priority items are claimed first.',
  }),
});
export type EnqueueQueueItemsBody = z.infer<typeof enqueueQueueItemsBodySchema>;

export const claimQueueItemBodySchema = z.object({
  workerId: z
    .string()
    .min(1)
    .meta({ example: 'openclaw-cron-2026-10-17T03:00' }),
  leaseSeconds: z.number().int().positive().max(3600).default(300).meta({
    description:
      'How long the claim is held before the item can be reclaimed. Extend with /heartbeat.',
  }),
});
export type ClaimQueueItemBody = z.infer<typeof claimQueueItemBodySchema>;

export const jobListQuerySchema = z.object({
  sourceId: z.uuid().optional().meta({
    description: 'Only this backup source’s jobs. Omit for all jobs.',
  }),
});
export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const queueItemListQuerySchema = z.object({
  status: z
    .enum(['queued', 'in_progress', 'completed', 'failed', 'skipped'])
    .optional(),
  jobId: z.uuid().optional(),
});
export type QueueItemListQuery = z.infer<typeof queueItemListQuerySchema>;

const claimTokenSchema = z.uuid().meta({
  description: 'The claimToken returned when the item was claimed.',
});

export const heartbeatQueueItemBodySchema = z.object({
  claimToken: claimTokenSchema,
  leaseSeconds: z.number().int().positive().max(3600).default(300),
});
export type HeartbeatQueueItemBody = z.infer<
  typeof heartbeatQueueItemBodySchema
>;

export const completeQueueItemBodySchema = z.object({
  claimToken: claimTokenSchema,
  discoveredPaths: z
    .array(windowsPathSchema)
    .max(MAX_PATHS_PER_REQUEST)
    .default([])
    .meta({
      description:
        'Child directories found inside this one; enqueued atomically with the completion.',
    }),
});
export type CompleteQueueItemBody = z.infer<typeof completeQueueItemBodySchema>;

export const failQueueItemBodySchema = z.object({
  claimToken: claimTokenSchema,
  error: z.string().min(1).meta({ example: 'EBUSY: resource busy or locked' }),
  retryable: z.boolean().default(true).meta({
    description:
      'false marks the failure permanent immediately instead of retrying.',
  }),
});
export type FailQueueItemBody = z.infer<typeof failQueueItemBodySchema>;

export const skipQueueItemBodySchema = z.object({
  claimToken: claimTokenSchema,
  reason: z.string().min(1).meta({ example: 'system directory' }),
});
export type SkipQueueItemBody = z.infer<typeof skipQueueItemBodySchema>;
