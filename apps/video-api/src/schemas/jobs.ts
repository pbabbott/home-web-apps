import { z } from 'zod';
import type { VideoJobStatus } from '@abbottland/video-db';

export const SUPPORTED_OPERATIONS = ['screenshots'] as const;

// Type-only import above keeps this in sync with video-db's status enum at
// compile time, without a runtime dependency on the module (which would
// otherwise break under jest.mock('@abbottland/video-db') in tests).
const JOB_STATUSES: readonly VideoJobStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

export const createJobSchema = z.object({
  operation: z.enum(SUPPORTED_OPERATIONS),
  inputPath: z.string().min(1, 'inputPath is required').meta({
    description: 'Path to the source video, relative to MEDIA_ROOT',
    example: '/videos/example.mp4',
  }),
  parameters: z.object({
    timestamps: z
      .array(z.number())
      .min(1, 'timestamps must be a non-empty array of numbers')
      .meta({
        description: 'Second offsets to capture a screenshot at',
        example: [30, 120, 300],
      }),
  }),
});

export type CreateJobBody = z.infer<typeof createJobSchema>;

export const jobIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
