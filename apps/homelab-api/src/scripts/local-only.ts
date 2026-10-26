import type { PostgresConfig } from '../config';
import { initDb } from '../db';

/**
 * The remote-to-local scripts (`pull-remote-into-local`,
 * `preserve-local-smb-connections`) only ever flow one way: a remote
 * environment (production) is read through its HTTP API, and the result is
 * written into the LOCAL database. A remote database is never a valid target.
 */
export class RemoteDatabaseTargetError extends Error {
  constructor(host: string) {
    super(
      `Refusing to run: POSTGRES_HOST is "${host}", which is not a local database. ` +
        'These scripts overwrite the database they are pointed at, so they only run ' +
        `against ${[...LOCAL_HOSTS].join(', ')}. A remote environment may only be used as the source.`,
    );
    this.name = 'RemoteDatabaseTargetError';
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Throws `RemoteDatabaseTargetError` unless the configured database is on this machine. */
export function assertDatabaseIsLocal(postgres: Pick<PostgresConfig, 'host'>) {
  const host = postgres.host.trim().toLowerCase();

  if (!LOCAL_HOSTS.has(host)) {
    throw new RemoteDatabaseTargetError(postgres.host);
  }
}

/**
 * The only way these scripts open a database connection: checks the target is
 * local first. Call it before migrations or any other database access.
 */
export function initLocalDb(postgres: Pick<PostgresConfig, 'host'>) {
  assertDatabaseIsLocal(postgres);
  initDb();
}
