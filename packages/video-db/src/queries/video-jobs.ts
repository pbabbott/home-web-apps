import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  videoJobs,
  type NewVideoJob,
  type VideoJob,
  type VideoJobStatus,
} from '../schema/video-jobs';

export type CreateVideoJobInput = Pick<
  NewVideoJob,
  'operation' | 'inputPath' | 'parameters'
>;

export const createVideoJob = async (
  db: Database,
  input: CreateVideoJobInput,
): Promise<VideoJob> => {
  const [job] = await db.insert(videoJobs).values(input).returning();

  return job;
};

export const getVideoJobById = async (
  db: Database,
  id: string,
): Promise<VideoJob | undefined> => {
  const [job] = await db.select().from(videoJobs).where(eq(videoJobs.id, id));

  return job;
};

export type ListVideoJobsOptions = {
  status?: VideoJobStatus;
};

const LIST_VIDEO_JOBS_LIMIT = 100;

export const listVideoJobs = async (
  db: Database,
  options: ListVideoJobsOptions = {},
): Promise<VideoJob[]> => {
  return db
    .select()
    .from(videoJobs)
    .where(options.status ? eq(videoJobs.status, options.status) : undefined)
    .orderBy(desc(videoJobs.createdAt))
    .limit(LIST_VIDEO_JOBS_LIMIT);
};

/**
 * Atomically claims the oldest pending job for `workerId`. Uses
 * `FOR UPDATE SKIP LOCKED` inside a transaction so concurrent workers never
 * claim the same row: each competing transaction just skips rows already
 * locked by another claim in flight, instead of blocking on them.
 */
export const claimNextVideoJob = async (
  db: Database,
  workerId: string,
): Promise<VideoJob | undefined> => {
  return db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: videoJobs.id })
      .from(videoJobs)
      .where(eq(videoJobs.status, 'pending'))
      .orderBy(videoJobs.createdAt)
      .limit(1)
      .for('update', { skipLocked: true });

    if (!next) return undefined;

    const [job] = await tx
      .update(videoJobs)
      .set({
        status: 'processing',
        workerId,
        startedAt: new Date(),
        heartbeatAt: new Date(),
        attempts: sql`${videoJobs.attempts} + 1`,
      })
      .where(eq(videoJobs.id, next.id))
      .returning();

    return job;
  });
};

export const heartbeatVideoJob = async (
  db: Database,
  id: string,
): Promise<void> => {
  await db
    .update(videoJobs)
    .set({ heartbeatAt: new Date() })
    .where(eq(videoJobs.id, id));
};

export const completeVideoJob = async (
  db: Database,
  id: string,
  outputPaths: string[],
): Promise<VideoJob> => {
  const [job] = await db
    .update(videoJobs)
    .set({ status: 'completed', completedAt: new Date(), outputPaths })
    .where(eq(videoJobs.id, id))
    .returning();

  return job;
};

export const failVideoJob = async (
  db: Database,
  id: string,
  error: string,
): Promise<VideoJob> => {
  const [job] = await db
    .update(videoJobs)
    .set({ status: 'failed', completedAt: new Date(), error })
    .where(eq(videoJobs.id, id))
    .returning();

  return job;
};
