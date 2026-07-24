import 'reflect-metadata';
import { runMigrationsWithLock } from '@abbottland/video-db';
import { config, initConfig, validateConfig } from './config';
import { initDb } from './db';
import { startServer } from './server';
import { startPollLoop, stopPollLoop } from './worker/poll-loop';
import { errorExit } from './process';

const start = async () => {
  await initConfig();
  validateConfig();

  try {
    await runMigrationsWithLock(config.postgres);
  } catch (err) {
    console.error('❌ Database migration failed:', err);
    errorExit();
    return;
  }

  initDb();
  startServer();
  startPollLoop();
};

const shutdown = async (signal: string) => {
  console.log(`${signal} received, finishing in-flight job before exit...`);
  await stopPollLoop();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start();
