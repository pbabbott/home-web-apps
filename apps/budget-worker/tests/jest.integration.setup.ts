import {
  closeDb,
  recreateTestDatabase,
  runMigrations,
} from '@abbottland/budget-db';
import request from 'supertest';
import { createServer } from '../src/server';
import {
  config,
  initConfig,
  validateConfig,
  YNAB_PLAN_UNSET,
  YNAB_TOKEN_UNSET,
} from '../src/config';
import { db, initDb } from '../src/db';

let app;

beforeAll(async () => {
  await initConfig();

  // CI loads the real YNAB token into .env (`pnpm env:generate`). Integration
  // tests must never spend its 200 requests/hour, so neutralise it here: with
  // the token unset a ynab_sync job fails before any request, and the dead URL
  // is a second layer. A test that needs YNAB behaviour mocks ynabGet and sets
  // its own config (see ynab-sync.integration.test.ts).
  config.ynab = {
    apiUrl: 'http://127.0.0.1:1',
    apiToken: YNAB_TOKEN_UNSET,
    planId: YNAB_PLAN_UNSET,
  };

  // Integration tests run against their own throwaway database on the same
  // Postgres server, never the developer's `budget` database (they create and
  // delete jobs, raw responses and cursors).
  config.postgres = {
    ...config.postgres,
    ...(await recreateTestDatabase(config.postgres, 'budget_worker_test')),
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
