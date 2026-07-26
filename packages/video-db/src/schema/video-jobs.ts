import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const videoJobStatusEnum = pgEnum('video_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const videoJobs = pgTable('video_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  operation: text('operation').notNull(),
  status: videoJobStatusEnum('status').notNull().default('pending'),
  inputPath: text('input_path').notNull(),
  outputPaths: text('output_paths').array(),
  parameters: jsonb('parameters').notNull().default({}),
  attempts: integer('attempts').notNull().default(0),
  workerId: text('worker_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
  error: text('error'),
});

export type VideoJob = typeof videoJobs.$inferSelect;
export type NewVideoJob = typeof videoJobs.$inferInsert;
export type VideoJobStatus = (typeof videoJobStatusEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the videoJobs table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: video-api's generated OpenAPI docs) without hand-editing.
 */
export const videoJobSelectSchema = createSelectSchema(videoJobs, {
  parameters: () => z.record(z.string(), z.unknown()),
  createdAt: dateTime,
  startedAt: dateTime,
  completedAt: dateTime,
  heartbeatAt: dateTime,
});
