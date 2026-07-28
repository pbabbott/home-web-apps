import {
  completeVideoJob,
  failVideoJob,
  heartbeatVideoJob,
  type VideoJob,
} from '@abbottland/video-db';
import { db } from '../db';
import { operationHandlers } from './operations';
import { JobProcessingError } from './job-processing-error';

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Runs the operation handler for `job` to completion and records the
 * result. Never throws: operation/ffmpeg failures are caught and recorded
 * on the job via failVideoJob so the poll loop can move on to the next job.
 */
export const processJob = async (job: VideoJob): Promise<void> => {
  const heartbeat = setInterval(() => {
    heartbeatVideoJob(db, job.id).catch((err) => {
      console.error(`⚠️  heartbeat failed for job ${job.id}:`, err);
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const handler = operationHandlers[job.operation];

    if (!handler) {
      throw new JobProcessingError(`unsupported operation: ${job.operation}`);
    }

    const result = await handler(job);

    await completeVideoJob(db, job.id, result.outputPaths, result.message);
    console.log(`✅ job ${job.id} completed: ${result.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(`❌ job ${job.id} failed:`, err);
    await failVideoJob(db, job.id, message);
  } finally {
    clearInterval(heartbeat);
  }
};
