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
// — via the paw_patrol_title_cards operation's computeEpisodeRuntime step
// — binds child_process.execFile at import time, and jest.mock() calls are
// hoisted above ALL imports in a file (including the '../src/server'
// import above), so this is what actually intercepts it. A per-test-file
// jest.mock would be too late: by then server.ts's module graph is already
// cached with the real execFile.
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
  path.join(os.tmpdir(), 'video-worker-media-'),
);
fs.mkdirSync(path.join(MEDIA_ROOT, 'Paw Patrol', 'Season 3'), {
  recursive: true,
});
fs.writeFileSync(
  path.join(
    MEDIA_ROOT,
    'Paw Patrol',
    'Season 3',
    'Paw Patrol - S03E01 - Pups Save a Blimp.mp4',
  ),
  'fake mp4',
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
