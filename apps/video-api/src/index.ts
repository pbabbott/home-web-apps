import 'reflect-metadata';
import { initConfig, validateConfig } from './config';
import { initDb } from './db';
import { startServer } from './server';

const start = async () => {
  await initConfig();
  validateConfig();

  initDb();
  startServer();
};

start();
