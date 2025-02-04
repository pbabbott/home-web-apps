import cron from 'node-cron';
import cronstrue from 'cronstrue';
import { syncPorts } from './services/syncService';
import { config } from './config';
import { logCronEnd, logCronStart, SyncCaller } from './data';

export const startCron = () => {
  // read cron config
  const cronExpression = config.cronExpression;
  const friendlyExpression = cronstrue.toString(cronExpression);
  console.log(
    `Cron is configured to run ${friendlyExpression} for TZ: ${config.TZ}`,
  );

  const options = {
    scheduled: true,
    timezone: config.TZ,
  };
  cron.schedule(cronExpression, cronJob, options);
};

export const cronJob = async () => {
  // Start routine
  const now = new Date();
  console.log(`Cronjob Starting run at ${now.toLocaleString('en-US')}`);
  logCronStart();

  const result = await syncPorts(SyncCaller.CRON);
  console.log(`Success=${result.success} : ${result.validationMessage}`);

  // End routine
  logCronEnd();
};
