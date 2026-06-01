import 'reflect-metadata';
import { initConfig, validateConfig } from './config';
import { startServer } from './server';

const start = async () => {
  await initConfig();
  validateConfig();
  startServer();
};

start();
