import path from 'path';
import { Client } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PostgresConnectionOptions } from './client';
import * as schema from './schema';

export const MIGRATIONS_FOLDER = path.join(
  __dirname,
  '..',
  'drizzle',
  'migrations',
);

/**
 * Accepts any node-postgres-backed drizzle instance (Pool- or
 * Client-backed) — runMigrationsWithLock below needs a single dedicated
 * Client, which is a narrower `$client` type than the app's usual
 * Pool-backed `Database`.
 */
export const runMigrations = async (
  db: NodePgDatabase<typeof schema>,
): Promise<void> => {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
};

/**
 * Arbitrary but stable — every process that migrates this database must
 * agree on the same key. Postgres session-level advisory locks release
 * automatically if the holding connection drops (e.g. the pod crashes
 * mid-migration), so this can never be left stuck held.
 */
const MIGRATION_LOCK_ID = 72_691_001;

/**
 * Runs migrations behind a Postgres advisory lock on a dedicated
 * connection, so multiple app replicas starting concurrently against a
 * fresh database serialize instead of racing. drizzle's migrate() itself
 * has no locking: two processes that both see "no migrations applied yet"
 * will both try to create the same tables, and the loser crashes on a
 * "relation already exists" error.
 */
export const runMigrationsWithLock = async (
  options: PostgresConnectionOptions,
): Promise<void> => {
  const client = new Client(options);
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await runMigrations(drizzle(client, { schema }));
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    await client.end();
  }
};
