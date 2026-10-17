export { createDb, closeDb, pingDb } from './client';
export type { Database, PostgresConnectionOptions } from './client';

export {
  hosts,
  hostTypeEnum,
  exporterTypeEnum,
  hostSelectSchema,
} from './schema/hosts';
export type { Host, NewHost, HostType, ExporterType } from './schema/hosts';

export {
  listHosts,
  getHostById,
  getHostByIpAddress,
  createHost,
  updateHost,
  deleteHost,
  HostInUseError,
} from './queries/hosts';
export type { CreateHostInput, UpdateHostInput } from './queries/hosts';

export {
  backupSources,
  discoveryJobs,
  discoveryQueueItems,
  backupSourceTypeEnum,
  discoveryJobStatusEnum,
  discoveryQueueItemStatusEnum,
  backupSourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
} from './schema/discovery';
export type {
  BackupSource,
  NewBackupSource,
  BackupSourceType,
  DiscoveryJob,
  NewDiscoveryJob,
  DiscoveryJobStatus,
  DiscoveryQueueItem,
  NewDiscoveryQueueItem,
  DiscoveryQueueItemStatus,
} from './schema/discovery';

export {
  DiscoveryError,
  createBackupSource,
  listBackupSources,
  getBackupSourceById,
  getQueueCounts,
  createDiscoveryJob,
  getDiscoveryJobById,
  listDiscoveryJobs,
  transitionDiscoveryJob,
  completeDiscoveryJob,
  getQueueItemById,
  listQueueItems,
  enqueueQueueItems,
  claimNextQueueItem,
  heartbeatQueueItem,
  completeQueueItem,
  failQueueItem,
  skipQueueItem,
  retryQueueItem,
  retryDelaySeconds,
} from './queries/discovery';
export type {
  CreateBackupSourceInput,
  QueuePath,
  QueueCounts,
  CreateDiscoveryJobInput,
  ListQueueItemsOptions,
  EnqueueQueueItemsInput,
  ClaimQueueItemInput,
  CompleteQueueItemInput,
  FailQueueItemInput,
} from './queries/discovery';

export {
  runMigrations,
  runMigrationsWithLock,
  hasAppliedLatestMigration,
  MIGRATIONS_FOLDER,
} from './migrations';
