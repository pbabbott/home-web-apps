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
  sources,
  discoveryJobs,
  discoveryQueueItems,
  inventoryItems,
  inventoryItemTypeEnum,
  sourceTypeEnum,
  discoveryJobStatusEnum,
  discoveryQueueItemStatusEnum,
  sourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  inventoryItemSelectSchema,
} from './schema/discovery';
export type {
  Source,
  NewSource,
  SourceType,
  DiscoveryJob,
  NewDiscoveryJob,
  DiscoveryJobStatus,
  DiscoveryQueueItem,
  NewDiscoveryQueueItem,
  DiscoveryQueueItemStatus,
  InventoryItem,
  NewInventoryItem,
  InventoryItemType,
} from './schema/discovery';

export {
  DiscoveryError,
  createSource,
  listSources,
  getSourceById,
  getQueueCounts,
  createDiscoveryJob,
  getDiscoveryJobById,
  listDiscoveryJobs,
  listAllDiscoveryJobs,
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
  recordInventoryItems,
  listInventoryItems,
} from './queries/discovery';
export type {
  CreateSourceInput,
  QueuePath,
  QueueCounts,
  CreateDiscoveryJobInput,
  ListAllDiscoveryJobsOptions,
  DiscoveryJobWithSource,
  ListQueueItemsOptions,
  EnqueueQueueItemsInput,
  ClaimQueueItemInput,
  ClaimQueueItemResult,
  ClaimIdleReason,
  CompleteQueueItemInput,
  FailQueueItemInput,
  InventoryPath,
  RecordInventoryItemsInput,
  ListInventoryItemsOptions,
} from './queries/discovery';

export {
  runMigrations,
  runMigrationsWithLock,
  hasAppliedLatestMigration,
  MIGRATIONS_FOLDER,
} from './migrations';
