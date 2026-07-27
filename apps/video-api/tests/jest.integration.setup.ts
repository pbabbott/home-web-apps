import fs from 'fs';
import os from 'os';
import path from 'path';
import { closeDb, runMigrations } from '@abbottland/video-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

// No ffprobe binary is guaranteed in CI/dev containers. This mock is
// registered here (not per-test-file) because createServer's module graph
// — via controllers/run-time.ts and controllers/title-cards.ts — binds
// child_process.execFile at import time, and jest.mock() calls are hoisted
// above ALL imports in a file (including the '../src/server' import above),
// so this is what actually intercepts it. A per-test-file jest.mock would
// be too late: by then server.ts's module graph is already cached with the
// real execFile. Individual test files can override the default stdout
// with execFile.mockImplementation(...).
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => callback(null, { stdout: '0\n', stderr: '' }),
  ),
}));

export const MEDIA_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), 'video-api-media-'),
);
fs.mkdirSync(path.join(MEDIA_ROOT, 'tv_shows', 'Show A'), {
  recursive: true,
});
fs.writeFileSync(path.join(MEDIA_ROOT, 'tv_shows', 'notes.txt'), 'hello');
fs.mkdirSync(path.join(MEDIA_ROOT, 'movies'), { recursive: true });

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
