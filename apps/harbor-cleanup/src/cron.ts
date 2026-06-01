import cron from 'node-cron';
import cronstrue from 'cronstrue';
import { runCleanup } from './services/cleanupService';
import { config } from './config';
import { logRunFailure, logRunStart, logRunSuccess } from './data';

export const startCron = () => {
  const cronExpression = config.cronExpression;
  const friendlyExpression = cronstrue.toString(cronExpression);
  console.log(
    `[cron] Cleanup scheduled: ${friendlyExpression} (TZ: ${config.TZ})`,
  );

  cron.schedule(cronExpression, cronJob, {
    scheduled: true,
    timezone: config.TZ,
  });
};

export const cronJob = async () => {
  const now = new Date();
  console.log(`[cron] Starting cleanup run at ${now.toLocaleString('en-US')}`);
  logRunStart('CRON');
  try {
    const result = await runCleanup();
    logRunSuccess(result);
    console.log(
      `[cron] Cleanup complete. Deleted ${result.totalDeleted}, errors ${result.totalErrors}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Cleanup failed: ${message}`);
    logRunFailure(message);
  }
};
