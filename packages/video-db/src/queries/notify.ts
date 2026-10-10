import { sql } from 'drizzle-orm';
import type { Database } from '../client';

/**
 * Notifies any `LISTEN video_job_steps` client that a job's status or one
 * of its steps changed, carrying the job id as the payload. Shared by both
 * video-jobs and video-job-steps queries so every writer (not just
 * video-worker) gets this for free — callers never need to remember to
 * notify separately.
 */
export const notifyJobStepsChanged = async (
  db: Database,
  jobId: string,
): Promise<void> => {
  await db.execute(sql`select pg_notify('video_job_steps', ${jobId})`);
};
