import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { closeDb, runMigrations } from '@abbottland/homelab-db';
import request from 'supertest';
import { createServer } from '../src/server';
import { initConfig, validateConfig } from '../src/config';
import { db, initDb } from '../src/db';

// A scratch directory stands in for the NFS mount, so the mount check is off.
export const DESTINATION_PATH = fs.mkdtempSync(
  path.join(os.tmpdir(), 'backup-worker-destination-'),
);
export const DESTINATION_ID = randomUUID();

// dotenv (loaded inside initConfig) does not override an already-set env var.
// Everything the worker requires is set here so the suite does not depend on
// a generated .env; the defaults match docker-compose.yaml.
process.env.BACKUP_DESTINATION_PATH = DESTINATION_PATH;
process.env.BACKUP_DESTINATION_ID = DESTINATION_ID;
process.env.BACKUP_DESTINATION_MOUNT_CHECK = 'none';
process.env.EXODUS_CREDENTIAL_KEY ||= randomBytes(32).toString('base64');
process.env.POLL_INTERVAL_MS = '50';
process.env.POSTGRES_HOST ||= 'localhost';
process.env.POSTGRES_PORT ||= '5433';
process.env.POSTGRES_DATABASE ||= 'homelab_api';
process.env.POSTGRES_USER ||= 'homelab_api';
process.env.POSTGRES_PASSWORD ||= 'Password123';

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
  fs.rmSync(DESTINATION_PATH, { recursive: true, force: true });
});

export const getRequest = () => request(app);
