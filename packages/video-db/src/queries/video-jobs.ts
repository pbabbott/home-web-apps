import { desc, eq } from 'drizzle-orm';
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
