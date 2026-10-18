import { z } from 'zod';
import { claimTokenSchema, windowsPathSchema } from './common';

export const queueItemIdParamsSchema = z.object({ id: z.uuid() });
export type QueueItemIdParams = z.infer<typeof queueItemIdParamsSchema>;

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

export const queueItemListQuerySchema = z.object({
  status: z
    .enum(['queued', 'in_progress', 'completed', 'failed', 'skipped'])
    .optional(),
  jobId: z.uuid().optional(),
});
export type QueueItemListQuery = z.infer<typeof queueItemListQuerySchema>;

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

export const jobQueueItemListQuerySchema = z.object({
  status: queueItemListQuerySchema.shape.status,
});
export type JobQueueItemListQuery = z.infer<typeof jobQueueItemListQuerySchema>;
