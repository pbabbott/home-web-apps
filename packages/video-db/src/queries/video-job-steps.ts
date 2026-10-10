import { asc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  videoJobSteps,
  type NewVideoJobStep,
  type VideoJobStep,
} from '../schema/video-job-steps';
import { notifyJobStepsChanged } from './notify';

export type CreateVideoJobStepInput = Pick<
  NewVideoJobStep,
  'jobId' | 'stepName' | 'message'
>;

export const createVideoJobStep = async (
  db: Database,
  input: CreateVideoJobStepInput,
): Promise<VideoJobStep> => {
  const [step] = await db.insert(videoJobSteps).values(input).returning();

  await notifyJobStepsChanged(db, step.jobId);

  return step;
};

export const completeVideoJobStep = async (
  db: Database,
  id: string,
  message?: string,
): Promise<VideoJobStep> => {
  const [step] = await db
    .update(videoJobSteps)
    .set({ status: 'completed', completedAt: new Date(), message })
    .where(eq(videoJobSteps.id, id))
    .returning();

  await notifyJobStepsChanged(db, step.jobId);

  return step;
};

export const failVideoJobStep = async (
  db: Database,
  id: string,
  message: string,
): Promise<VideoJobStep> => {
  const [step] = await db
    .update(videoJobSteps)
    .set({ status: 'failed', completedAt: new Date(), message })
    .where(eq(videoJobSteps.id, id))
    .returning();

  await notifyJobStepsChanged(db, step.jobId);

  return step;
};

export const listVideoJobStepsByJobId = async (
  db: Database,
  jobId: string,
): Promise<VideoJobStep[]> => {
  return db
    .select()
    .from(videoJobSteps)
    .where(eq(videoJobSteps.jobId, jobId))
    .orderBy(asc(videoJobSteps.startedAt));
};
