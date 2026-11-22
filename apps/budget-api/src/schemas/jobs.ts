import { z } from 'zod';
import type { BudgetJobStatus } from '@abbottland/budget-db';

// Type-only import keeps this in sync with budget-db's status enum at
// compile time without a runtime dependency (which would break under
// jest.mock('@abbottland/budget-db') in tests).
const JOB_STATUSES: readonly BudgetJobStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

const helloJobSchema = z.object({
  operation: z.literal('hello'),
  parameters: z
    .object({
      name: z.string().min(1).optional().meta({
        description: 'Who to greet',
        example: 'world',
      }),
    })
    .default({}),
});

const ynabSyncJobSchema = z.object({
  operation: z.literal('ynab_sync'),
  parameters: z
    .object({
      endpoints: z
        .array(
          z.enum([
            'accounts',
            'categories',
            'months',
            'payees',
            'scheduled_transactions',
            'transactions',
          ]),
        )
        .optional()
        .meta({ description: 'Only sync these endpoints (default: all)' }),
      full: z.boolean().optional().meta({
        description:
          'Ignore stored delta cursors and fetch full snapshots (costs more of the 200 requests/hour)',
      }),
    })
    .default({}),
});

const ynabTransformJobSchema = z.object({
  operation: z.literal('ynab_transform'),
  parameters: z
    .object({
      endpoints: z
        .array(
          z.enum([
            'accounts',
            'categories',
            'months',
            'payees',
            'scheduled_transactions',
            'transactions',
          ]),
        )
        .optional()
        .meta({ description: 'Only transform these endpoints (default: all)' }),
      rebuild: z.boolean().optional().meta({
        description:
          'Drop the typed rows for these endpoints and re-fold every raw response (no YNAB calls)',
      }),
    })
    .default({}),
});

/**
 * Discriminated on `operation` so each job type declares its own
 * `parameters` shape. Adding a new operation means adding a branch here
 * (and a handler in budget-worker), not widening a shared `parameters` bag.
 */
export const createJobSchema = z.discriminatedUnion('operation', [
  helloJobSchema,
  ynabSyncJobSchema,
  ynabTransformJobSchema,
]);

export type CreateJobBody = z.infer<typeof createJobSchema>;

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export const listRawResponsesQuerySchema = z.object({
  planId: z.string().min(1).optional(),
  endpoint: z
    .enum([
      'plans',
      'accounts',
      'categories',
      'months',
      'payees',
      'scheduled_transactions',
      'transactions',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type ListRawResponsesQuery = z.infer<typeof listRawResponsesQuerySchema>;

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
