import 'reflect-metadata';
import { initConfig, validateConfig } from './config';
import { initDb } from './db';
import { startServer } from './server';
import { startPollLoop, stopPollLoop } from './worker/poll-loop';

const start = async () => {
  await initConfig();
  validateConfig();

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
