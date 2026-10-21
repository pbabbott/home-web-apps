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
  exclusionRules,
  auditEvents,
  inventoryItemKindEnum,
  sourceTypeEnum,
  discoveryJobStatusEnum,
  discoveryQueueItemStatusEnum,
  exclusionRuleScopeEnum,
  inventoryItemRecommendationEnum,
  inventoryItemConfidenceEnum,
  inventoryItemDecisionEnum,
  inventoryItems,
  auditActorTypeEnum,
  sourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  exclusionRuleSelectSchema,
  auditEventSelectSchema,
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
  InventoryItemKind,
  ExclusionRule,
  NewExclusionRule,
  ExclusionRuleScope,
  InventoryItem,
  NewInventoryItem,
  InventoryItemRecommendation,
  InventoryItemConfidence,
  InventoryItemDecision,
  InventoryItemEvidence,
  InventoryItemContentKind,
  InventoryItemGitEvidence,
  QueueItemResult,
  AuditEvent,
  NewAuditEvent,
  AuditActorType,
  AuditEventType,
} from './schema/discovery';

export { insertAuditEvent, listAuditEvents } from './queries/audit';
export type {
  Actor,
  AuditEventInput,
  ListAuditEventsOptions,
} from './queries/audit';

export {
  resolveExclusion,
  listExclusionRules,
  createExclusionRule,
  updateExclusionRule,
  deleteExclusionRule,
} from './queries/exclusion-rules';
export type {
  ExclusionState,
  ExclusionResolution,
  ListExclusionRulesOptions,
  CreateExclusionRuleInput,
  UpdateExclusionRuleInput,
} from './queries/exclusion-rules';

export {
  upsertInventoryItems,
  getInventoryItemById,
  decideInventoryItem,
  listInventoryItems,
  findNestedInventoryItems,
} from './queries/inventory-items';
export type {
  InventoryItemInput,
  UpsertInventoryItemsInput,
  UpsertedInventoryItem,
  InventoryItemWithExclusion,
  DecideInventoryItemInput,
  ListInventoryItemsOptions,
  NestedInventoryItem,
} from './queries/inventory-items';

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
  listKnownSkips,
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
  KnownSkip,
  ListKnownSkipsOptions,
  ClaimIdleReason,
  CompleteQueueItemInput,
  FailQueueItemInput,
} from './queries/discovery';

export {
  runMigrations,
  runMigrationsWithLock,
  hasAppliedLatestMigration,
  MIGRATIONS_FOLDER,
} from './migrations';
