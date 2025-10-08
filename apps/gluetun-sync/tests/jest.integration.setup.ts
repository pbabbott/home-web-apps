import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import request from 'supertest';

let app;

beforeAll(async () => {
  // Initialize config and create the app instance
  await initConfig();
  validateConfig();

  app = createServer();
});

export const getRequest = () => request(app);
