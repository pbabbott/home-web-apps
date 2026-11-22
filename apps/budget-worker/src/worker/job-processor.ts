import {
  completeBudgetJob,
  failBudgetJob,
  heartbeatBudgetJob,
  type BudgetJob,
} from '@abbottland/budget-db';
import { db } from '../db';
import { operationHandlers } from './operations';
import { JobProcessingError } from './job-processing-error';

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Runs the operation handler for `job` to completion and records the
 * result. Never throws: operation/ffmpeg failures are caught and recorded
 * on the job via failBudgetJob so the poll loop can move on to the next job.
 */
export const processJob = async (job: BudgetJob): Promise<void> => {
  const heartbeat = setInterval(() => {
    heartbeatBudgetJob(db, job.id).catch((err) => {
      console.error(`⚠️  heartbeat failed for job ${job.id}:`, err);
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const handler = operationHandlers[job.operation];

    if (!handler) {
      throw new JobProcessingError(`unsupported operation: ${job.operation}`);
    }

    const result = await handler(job);

    await completeBudgetJob(db, job.id, result.message);
    console.log(`✅ job ${job.id} completed: ${result.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(`❌ job ${job.id} failed:`, err);
    await failBudgetJob(db, job.id, message);
  } finally {
    clearInterval(heartbeat);
  }
};
