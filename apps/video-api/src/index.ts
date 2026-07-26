import 'reflect-metadata';
import { runMigrationsWithLock } from '@abbottland/video-db';
import { config, initConfig, validateConfig } from './config';
import { initDb } from './db';
import { startServer } from './server';
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
};

start();
