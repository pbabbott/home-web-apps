import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { videoJobs } from './video-jobs';

export const videoJobStepStatusEnum = pgEnum('video_job_step_status', [
  'in_progress',
  'completed',
  'failed',
]);

/**
 * One row per step execution within a video_jobs run. Written by whoever is
 * actually running the step (currently video-worker's runSteps) — created
 * the instant a step starts (hence no 'pending' status: a row only exists
 * once its step is in_progress), updated to completed/failed when it
 * finishes. Ordered purely by startedAt — steps run strictly sequentially
 * and awaited, so insert order is monotonic in practice.
 */
export const videoJobSteps = pgTable('video_job_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => videoJobs.id, { onDelete: 'cascade' }),
  stepName: text('step_name').notNull(),
  status: videoJobStepStatusEnum('status').notNull().default('in_progress'),
  /** Current "what's happening"/"what happened" text — overwritten at each status transition. */
  message: text('message'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export type VideoJobStep = typeof videoJobSteps.$inferSelect;
export type NewVideoJobStep = typeof videoJobSteps.$inferInsert;
export type VideoJobStepStatus =
  (typeof videoJobStepStatusEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the videoJobSteps table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: video-api's generated OpenAPI docs) without hand-editing.
 */
export const videoJobStepSelectSchema = createSelectSchema(videoJobSteps, {
  startedAt: dateTime,
  completedAt: dateTime,
});
