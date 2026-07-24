import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
  outputPath: text('output_path'),
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
