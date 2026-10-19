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

const followUpSchema = z.object({
  path: windowsPathSchema,
  reason: z.string().trim().min(1).max(300).optional().meta({
    description:
      'Why this directory is worth exploring. Shown to whoever claims it, who starts with no memory of this session.',
  }),
  priority: z.number().int().optional().meta({
    description: 'Higher priority items are claimed first. Default 0.',
  }),
});

const MAX_SKIPPED_PER_REQUEST = 100;

export const completeQueueItemBodySchema = z.object({
  claimToken: claimTokenSchema,
  discoveredPaths: z
    .array(z.union([windowsPathSchema, followUpSchema]))
    .max(MAX_PATHS_PER_REQUEST)
    .default([])
    .meta({
      description:
        'Follow-up directories worth exploring, as plain paths or { path, reason?, priority? }; enqueued atomically with the completion. Do not list every child: queue only paths that need more inspection. Paths under an exclusion rule are skipped immediately.',
    }),
  summary: z.string().trim().min(1).max(1000).optional().meta({
    description: 'What was concluded about this directory.',
  }),
  skipped: z
    .array(
      z.object({
        path: windowsPathSchema,
        reason: z.string().trim().min(1).max(300),
      }),
    )
    .max(MAX_SKIPPED_PER_REQUEST)
    .default([])
    .meta({
      description:
        'Paths inside this directory that were seen and deliberately not explored or queued (system, generated, replaceable), with why. A per-run judgment, not a persistent exclusion rule.',
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

export const knownSkipListQuerySchema = z.object({
  pathPrefix: windowsPathSchema.optional().meta({
    description:
      'Only skips at or beneath this path, e.g. the job root, so unrelated parts of the source are left out.',
  }),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});
export type KnownSkipListQuery = z.infer<typeof knownSkipListQuerySchema>;
