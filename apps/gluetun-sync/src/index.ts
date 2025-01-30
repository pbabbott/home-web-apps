import 'reflect-metadata';
import { initConfig, validateConfig } from './config';
import { startServer } from './server';
import { cronJob, startCron } from './cron';

const start = async () => {
  await initConfig();
  validateConfig();

  startCron();
  startServer();

  // Run cron once at the start after 10 seconds
  setTimeout(cronJob, 1000 * 10);
};

start();
