import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import request from 'supertest';

let app: ReturnType<typeof createServer>;

beforeAll(async () => {
  await initConfig();
  validateConfig();
  app = createServer();
});

export const getRequest = () => request(app);
