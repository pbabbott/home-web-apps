import { z } from 'zod';
import type { VideoJobStatus } from '@abbottland/video-db';

// Type-only import above keeps this in sync with video-db's status enum at
// compile time, without a runtime dependency on the module (which would
// otherwise break under jest.mock('@abbottland/video-db') in tests).
const JOB_STATUSES: readonly VideoJobStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

const pawPatrolTitleCardsJobSchema = z.object({
  operation: z.literal('paw_patrol_title_cards'),
  parameters: z.object({
    seasonNumber: z.number().int().positive().meta({
      description: 'Paw Patrol season number to generate title cards for',
      example: 3,
    }),
  }),
});

const pawPatrolFileSuggestionsJobSchema = z.object({
  operation: z.literal('paw_patrol_file_suggestions'),
  parameters: z.object({
    seasonNumber: z.number().int().positive().meta({
      description:
        'Paw Patrol season number to generate file rename suggestions for',
      example: 3,
    }),
    model: z.string().min(1).optional().meta({
      description:
        'AI model to request for this job’s episode-matching calls, overriding the worker’s configured default',
      example: 'qwen/qwen3-vl-8b-instruct',
    }),
  }),
});

const pawPatrolApplyFileRenamesJobSchema = z.object({
  operation: z.literal('paw_patrol_apply_file_renames'),
  // No inputs — applies every pending file_renames row, not a season-scoped
  // subset. .default({}) lets a caller omit `parameters` entirely.
  parameters: z.object({}).default({}),
});

/**
 * Discriminated on `operation` so each job type declares its own
 * `parameters` shape. Adding a new operation means adding a branch here,
 * not widening a shared `parameters` bag.
 */
export const createJobSchema = z.discriminatedUnion('operation', [
  pawPatrolTitleCardsJobSchema,
  pawPatrolFileSuggestionsJobSchema,
  pawPatrolApplyFileRenamesJobSchema,
]);

export type CreateJobBody = z.infer<typeof createJobSchema>;

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
