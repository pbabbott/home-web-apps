export { createDb, closeDb, pingDb } from './client';
export type { Database, PostgresConnectionOptions } from './client';

export { hosts, hostTypeEnum, hostSelectSchema } from './schema/hosts';
export type { Host, NewHost, HostType } from './schema/hosts';

export {
  listHosts,
  getHostById,
  createHost,
  updateHost,
  deleteHost,
} from './queries/hosts';
export type { CreateHostInput, UpdateHostInput } from './queries/hosts';

export {
  runMigrations,
  runMigrationsWithLock,
  hasAppliedLatestMigration,
  MIGRATIONS_FOLDER,
} from './migrations';
