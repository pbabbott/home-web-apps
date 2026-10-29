import 'reflect-metadata';
import fs from 'fs';
import { runMigrationsWithLock } from '@abbottland/homelab-db';
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

  // Local development: no mount to wait for, so the scratch directory is ours to make.
  if (config.backupDestinationMountCheck === 'none') {
    fs.mkdirSync(config.backupDestinationPath, { recursive: true });
  }

  initDb();
  startServer();
  startPollLoop();
};

/** Under the pod's termination grace period (60 s): a hung mount must not hold the exit. */
const SHUTDOWN_DEADLINE_MS = 30_000;

const shutdown = async (signal: string) => {
  console.log(
    `${signal} received, releasing the item in flight before exit...`,
  );
  setTimeout(() => {
    console.error('❌ shutdown took too long, exiting');
    process.exit(1);
  }, SHUTDOWN_DEADLINE_MS).unref();
  await stopPollLoop();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start();
