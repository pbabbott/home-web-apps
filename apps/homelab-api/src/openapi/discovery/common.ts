import {
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
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

export const queueSummaryShape = {
  queueCounts: queueCountsSchema,
  staleClaims: z.number().meta({
    description:
      'In-progress items whose lease has expired; always 0 for a finished job. They are only returned to the queue by the next claim, so this is how a stuck run shows up between ticks.',
  }),
  lastActivityAt: z.string().nullable().meta({
    format: 'date-time',
    description:
      'Most recent change to any item of the job; null if it has none.',
  }),
  lastWorker: z.string().nullable().meta({
    description: 'workerId of the most recently changed claimed item.',
  }),
  phase: z
    .enum(['work_remaining', 'stuck_claims', 'awaiting_completion'])
    .nullable()
    .meta({
      description:
        'Active jobs only (null once finished). work_remaining: queued or in-progress work; stuck_claims: a lease expired and the next claim will reclaim it; awaiting_completion: nothing left, a human completes the job (failed items may still need a retry).',
    }),
};

export const discoveryJobResponseSchema =
  discoveryJobSelectSchema.extend(queueSummaryShape);

/** A listed queue item, with how many inventory items it last proposed or added. */
export const queueItemListEntrySchema = discoveryQueueItemSelectSchema.extend({
  inventoryCount: z.number().int().meta({
    description:
      'Inventory items last proposed or added from this directory; a later job may take one over.',
  }),
});

/** A job's listed queue item, with whether a human has dealt with all of its skips. */
export const jobQueueItemListEntrySchema = queueItemListEntrySchema.extend({
  skipsReviewed: z.boolean().nullable().meta({
    description:
      'True when every skipped path is acknowledged or in the inventory and every skipped pattern is acknowledged; null until the directory has a result.',
  }),
});

export const queueItemDetailSchema = queueItemListEntrySchema.extend({
  job: z.object({
    id: z.uuid(),
    sourceId: z.uuid(),
    rootPath: z.string(),
    status: z.string(),
  }),
  skipReview: z.object({
    reviewed: z.boolean().nullable(),
    paths: z.array(
      z.object({
        path: z.string(),
        acknowledged: z.boolean(),
        inventoried: z.boolean(),
      }),
    ),
    patterns: z.array(
      z.object({ pattern: z.string(), acknowledged: z.boolean() }),
    ),
  }),
  directoryApproved: z.boolean().meta({
    description: 'The directory itself is an approved inventory item.',
  }),
});

export const queueItemWithCreatedSchema = discoveryQueueItemSelectSchema.extend(
  {
    created: z.boolean().meta({
      description: 'false if this path was already queued for the job.',
    }),
  },
);

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
    job: z
      .object({ id: z.uuid(), sourceId: z.uuid(), rootPath: z.string() })
      .optional()
      .meta({
        description: 'Present with a claimed item: the job it belongs to.',
      }),
    queueCounts: queueCountsSchema.optional().meta({
      description:
        'The job’s queue after the claim; when idle from the any-job claim, summed over the active jobs.',
    }),
  })
  .meta({ id: 'ClaimResult' });

export const completedQueueItemSchema = discoveryQueueItemSelectSchema.extend({
  children: z.array(queueItemWithCreatedSchema),
});

export const discoveryJobWithSourceSchema = discoveryJobSelectSchema.extend({
  ...queueSummaryShape,
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

export const exclusionResolutionSchema = z.object({
  state: z.enum(['none', 'selective', 'excluded']),
  ruleIds: z.array(z.uuid()).meta({
    description: 'The rules that decided the state.',
  }),
});
