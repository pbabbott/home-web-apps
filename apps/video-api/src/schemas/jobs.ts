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

const titleCardsJobSchema = z.object({
  operation: z.literal('title_cards'),
  parameters: z.object({
    series: z.string().min(1).meta({
      description: 'Display name of the series to generate title cards for',
      example: 'Paw Patrol',
    }),
    seasonNumber: z.number().int().positive().meta({
      description: 'Season number to generate title cards for',
      example: 3,
    }),
    model: z.string().min(1).optional().meta({
      description:
        'AI model to request for this job’s title-card detection calls, overriding the worker’s configured default',
      example: 'qwen/qwen3-vl-8b-instruct',
    }),
  }),
});

const fileSuggestionsJobSchema = z.object({
  operation: z.literal('file_suggestions'),
  parameters: z.object({
    series: z.string().min(1).meta({
      description:
        'Display name of the series to generate file rename suggestions for',
      example: 'Paw Patrol',
    }),
    seasonNumber: z.number().int().positive().meta({
      description: 'Season number to generate file rename suggestions for',
      example: 3,
    }),
    model: z.string().min(1).optional().meta({
      description:
        'AI model to request for this job’s episode-matching calls, overriding the worker’s configured default',
      example: 'qwen/qwen3-vl-8b-instruct',
    }),
  }),
});

const applyFileRenamesJobSchema = z.object({
  operation: z.literal('apply_file_renames'),
  // No inputs — applies every pending file_renames row across every series,
  // not a season/series-scoped subset. .default({}) lets a caller omit
  // `parameters` entirely.
  parameters: z.object({}).default({}),
});

/**
 * Discriminated on `operation` so each job type declares its own
 * `parameters` shape. Adding a new operation means adding a branch here,
 * not widening a shared `parameters` bag.
 */
export const createJobSchema = z.discriminatedUnion('operation', [
  titleCardsJobSchema,
  fileSuggestionsJobSchema,
  applyFileRenamesJobSchema,
]);

export type CreateJobBody = z.infer<typeof createJobSchema>;

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
