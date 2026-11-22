import { Client } from 'pg';
import type { PostgresConnectionOptions } from './client';

/** Only databases named like `<something>_test` may be dropped and recreated. */
const TEST_DATABASE_NAME = /^[a-z][a-z0-9_]*_test$/;

/**
 * Throws unless `name` is a throwaway test database name. The drop in
 * recreateTestDatabase is destructive, so this is the guard that keeps an
 * integration-test setup from ever wiping a real (dev/prod) database.
 */
export const assertTestDatabaseName = (name: string): void => {
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(
      `Refusing to recreate database "${name}": test database names must match ${TEST_DATABASE_NAME}`,
    );
  }
};

/**
 * Drops and recreates an empty test database on the same Postgres server, so
 * integration tests never share state with a developer's real database (or
 * with each other). Connects to the server's maintenance `postgres` database
 * with the given credentials, which therefore need CREATEDB (the dev/CI
 * Postgres image's user is a superuser). Returns the options to connect to
 * the new database with.
 */
export const recreateTestDatabase = async (
  options: PostgresConnectionOptions,
  name: string,
): Promise<PostgresConnectionOptions> => {
  assertTestDatabaseName(name);

  const client = new Client({ ...options, database: 'postgres' });
  await client.connect();

  try {
    // `name` is validated above, so interpolating it as an identifier is safe.
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  return { ...options, database: name };
};
