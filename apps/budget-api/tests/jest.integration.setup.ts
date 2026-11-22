import {
  closeDb,
  recreateTestDatabase,
  runMigrations,
} from '@abbottland/budget-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { config, initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

let app;

beforeAll(async () => {
  await initConfig();

  // Integration tests run against their own throwaway database on the same
  // Postgres server, never the developer's `budget` database (they create and
  // delete jobs, raw responses and cursors).
  config.postgres = {
    ...config.postgres,
    ...(await recreateTestDatabase(config.postgres, 'budget_api_test')),
  };
  validateConfig();

  initDb();
  await runMigrations(db);

  app = createServer();
});

afterAll(async () => {
  await closeDb(db);
});

export const getRequest = () => request(app);
