import {
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  inventoryItemSelectSchema,
} from '@abbottland/homelab-db';
import { z } from 'zod';

export const conflictSchema = z.object({
  message: z
    .string()
    .meta({ example: 'job still has queued or in-progress work' }),
});

export const conflictResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: conflictSchema } },
});

export const discoveryNotFoundResponse = (what: string) => ({
  description: `No ${what} exists with this id`,
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: `${what} not found` }),
      }),
    },
  },
});

export const queueCountsSchema = z
  .object({
    queued: z.number(),
    in_progress: z.number(),
    completed: z.number(),
    failed: z.number(),
    skipped: z.number(),
  })
  .meta({
    description:
      'This job’s item counts by status. failed > 0 on a completed job means it finished with failures.',
  });

export const discoveryJobResponseSchema = discoveryJobSelectSchema.extend({
  queueCounts: queueCountsSchema,
});

export const queueItemWithCreatedSchema = discoveryQueueItemSelectSchema.extend(
  {
    created: z.boolean().meta({
      description: 'false if this path was already queued for the job.',
    }),
  },
);

export const inventoryItemWithCreatedSchema = inventoryItemSelectSchema.extend({
  created: z.boolean().meta({
    description: 'false if this path was already recorded for the source.',
  }),
});

export const claimResultSchema = z
  .object({
    item: discoveryQueueItemSelectSchema.nullable().meta({
      description: 'The claimed item, or null if nothing is claimable.',
    }),
    reason: z
      .enum(['queue_empty', 'retry_backoff', 'in_progress'])
      .optional()
      .meta({
        description:
          'Present when item is null. queue_empty: nothing queued or in progress, so the job can be completed. retry_backoff: queued items are waiting out a retry delay. in_progress: only other workers’ leases remain.',
      }),
    retryAt: z.string().nullable().optional().meta({
      format: 'date-time',
      description:
        'Present when item is null. When it is worth claiming again (null for queue_empty).',
    }),
    queueCounts: queueCountsSchema.optional(),
  })
  .meta({ id: 'ClaimResult' });

export const completedQueueItemSchema = discoveryQueueItemSelectSchema.extend({
  children: z.array(queueItemWithCreatedSchema),
});

export const discoveryJobWithSourceSchema = discoveryJobSelectSchema.extend({
  sourceName: z.string(),
  hostId: z.uuid().nullable().meta({
    description: 'The host the job’s source is linked to, if any.',
  }),
});

export const actorHeaders = z.object({
  'x-actor-type': z.enum(['human', 'openclaw', 'system']).optional().meta({
    description: 'Who is making the change, for the audit log. Default human.',
  }),
  'x-actor-id': z.string().optional().meta({
    description: 'Free-form identifier of the actor, for the audit log.',
  }),
});
