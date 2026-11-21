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

/**
 * Discriminated on `operation` so each job type declares its own
 * `parameters` shape. Adding a new operation means adding a branch here
 * (and a handler in budget-worker), not widening a shared `parameters` bag.
 */
export const createJobSchema = z.discriminatedUnion('operation', [
  helloJobSchema,
]);

export type CreateJobBody = z.infer<typeof createJobSchema>;

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
