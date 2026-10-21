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
  candidateKindEnum,
  sourceTypeEnum,
  discoveryJobStatusEnum,
  discoveryQueueItemStatusEnum,
  exclusionRuleScopeEnum,
  candidateRecommendationEnum,
  candidateConfidenceEnum,
  candidateDecisionEnum,
  reviewCandidates,
  auditActorTypeEnum,
  sourceSelectSchema,
  discoveryJobSelectSchema,
  discoveryQueueItemSelectSchema,
  exclusionRuleSelectSchema,
  auditEventSelectSchema,
  reviewCandidateSelectSchema,
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
  CandidateKind,
  ExclusionRule,
  NewExclusionRule,
  ExclusionRuleScope,
  ReviewCandidate,
  NewReviewCandidate,
  CandidateRecommendation,
  CandidateConfidence,
  CandidateDecision,
  CandidateEvidence,
  CandidateContentKind,
  CandidateGitEvidence,
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
  upsertReviewCandidates,
  getReviewCandidateById,
  decideReviewCandidate,
  listReviewCandidates,
  findNestedCandidates,
} from './queries/review-candidates';
export type {
  CandidateInput,
  UpsertReviewCandidatesInput,
  UpsertedCandidate,
  ReviewCandidateWithExclusion,
  DecideReviewCandidateInput,
  ListReviewCandidatesOptions,
  NestedCandidate,
} from './queries/review-candidates';

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
