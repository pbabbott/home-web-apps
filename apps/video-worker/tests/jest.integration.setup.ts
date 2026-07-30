import fs from 'fs';
import os from 'os';
import path from 'path';
import { closeDb, runMigrations } from '@abbottland/video-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

// No ffprobe/ffmpeg binary is guaranteed in CI/dev containers, so
// child_process is mocked here as the default for any integration test
// that exercises the video-worker pipeline without registering its own
// child_process mock (a test file's own jest.mock('child_process', ...),
// if it has one, wins — see poll-loop.integration.test.ts). Writes a stub
// file at ffmpeg's output path (its last arg, always a .jpg here) so
// steps that read the "generated" screenshot back off disk
// (detectEpisodeTitleCards) have real bytes to read.
jest.mock('child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      args: string[],
      callback: (err: Error | null, result?: unknown) => void,
    ) => {
      const outputPath = args[args.length - 1];

      if (outputPath.endsWith('.jpg')) {
        require('fs').writeFileSync(outputPath, 'fake jpg bytes');
      }

      callback(null, { stdout: '0\n', stderr: '' });
    },
  ),
}));

// No AI API server is guaranteed reachable in CI/dev containers either.
// Unlike execFile, fetch is a global looked up at call time (not bound at
// module-import time), so this can just be assigned here rather than
// needing jest.mock's hoisting — every screenshot "shows no title card" by
// default, which is enough for the claim -> process -> complete round trip.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: '{"found":false}' } }],
      }),
  }),
) as unknown as typeof fetch;

export const MEDIA_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), 'video-worker-media-'),
);
fs.mkdirSync(
  path.join(MEDIA_ROOT, 'media', 'tv_shows', 'Paw Patrol', 'Season 3'),
  {
    recursive: true,
  },
);
fs.writeFileSync(
  path.join(
    MEDIA_ROOT,
    'media',
    'tv_shows',
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
