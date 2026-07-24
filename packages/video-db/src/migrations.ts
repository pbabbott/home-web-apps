import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client';

export const MIGRATIONS_FOLDER = path.join(
  __dirname,
  '..',
  'drizzle',
  'migrations',
);

export const runMigrations = async (db: Database): Promise<void> => {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
};
