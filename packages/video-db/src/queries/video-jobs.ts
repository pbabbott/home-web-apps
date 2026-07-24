import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  videoJobs,
  type NewVideoJob,
  type VideoJob,
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
