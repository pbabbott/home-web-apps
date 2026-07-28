import fs from 'fs';
import os from 'os';
import path from 'path';
import { closeDb, runMigrations } from '@abbottland/video-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

export const MEDIA_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), 'video-worker-media-'),
);

// dotenv (loaded inside initConfig) does not override an already-set env var.
process.env.MEDIA_ROOT = MEDIA_ROOT;

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
  fs.rmSync(MEDIA_ROOT, { recursive: true, force: true });
});

export const getRequest = () => request(app);
