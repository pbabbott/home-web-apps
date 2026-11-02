import { closeDb, runMigrations } from '@abbottland/homelab-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

// The self-hosted CI runners are several times slower than a workstation.
// Jest ignores testTimeout inside `projects`, so it is set here.
jest.setTimeout(30_000);

let app;

beforeAll(async () => {
  await initConfig();
  validateConfig();

  initDb();
  await runMigrations(db);

  app = createServer();
});

afterAll(async () => {
  await closeDb(db);
});

export const getRequest = () => request(app);
