export { createDb, closeDb, pingDb } from './client';
export type { Database, PostgresConnectionOptions } from './client';

export {
  budgetJobs,
  budgetJobStatusEnum,
  budgetJobSelectSchema,
} from './schema/budget-jobs';
export type {
  BudgetJob,
  NewBudgetJob,
  BudgetJobStatus,
} from './schema/budget-jobs';

export {
  createBudgetJob,
  getBudgetJobById,
  listBudgetJobs,
  claimNextBudgetJob,
  heartbeatBudgetJob,
  completeBudgetJob,
  failBudgetJob,
} from './queries/budget-jobs';
export type {
  CreateBudgetJobInput,
  ListBudgetJobsOptions,
} from './queries/budget-jobs';

export {
  ynabRawResponses,
  ynabRawResponseSelectSchema,
  YNAB_ENDPOINTS,
} from './schema/ynab-raw-responses';
export type {
  YnabRawResponse,
  NewYnabRawResponse,
  YnabEndpoint,
} from './schema/ynab-raw-responses';

export {
  ynabSyncState,
  ynabSyncStateSelectSchema,
} from './schema/ynab-sync-state';
export type { YnabSyncState } from './schema/ynab-sync-state';

export {
  recordYnabRawResponse,
  getYnabSyncState,
  listYnabSyncState,
  listYnabRawResponses,
  listYnabRawResponseSummaries,
  listYnabPlans,
  listYnabSyncRuns,
} from './queries/ynab-raw';
export type {
  RecordYnabRawResponseInput,
  ListYnabRawResponsesOptions,
  ListYnabRawResponseSummariesOptions,
  YnabRawResponseSummary,
  YnabPlanSummary,
  YnabSyncRun,
} from './queries/ynab-raw';

export { assertTestDatabaseName, recreateTestDatabase } from './test-database';

export {
  runMigrations,
  runMigrationsWithLock,
  hasAppliedLatestMigration,
  MIGRATIONS_FOLDER,
} from './migrations';

export {
  applyYnabRawResponse,
  getLatestYnabPlansResponse,
  getYnabRawPayload,
  getYnabTransformState,
  isYnabPlansCurrent,
  listPendingYnabRawResponses,
  listYnabRawPlanIds,
  resetYnabTransform,
  upsertYnabPlans,
  YNAB_ENDPOINT_TABLES,
} from './queries/ynab-transform';
export type {
  ApplyYnabRawResponseInput,
  PendingYnabRawResponse,
  YnabPlanEndpoint,
  YnabTransformRows,
} from './queries/ynab-transform';

export * from './schema/ynab-entities';
export * from './schema/ynab-transactions';
export * from './schema/ynab-months';
export { ynabTransformState } from './schema/ynab-transform-state';
export type { YnabTransformState } from './schema/ynab-transform-state';
export { ynabTransactionsEnriched } from './schema/views/ynab-transactions-enriched';

export * from './schema/budget-filter-selections';
export * from './filter-selection-rules';
export {
  createFilterSelection,
  updateFilterSelection,
  deleteFilterSelection,
  getFilterSelection,
  listFilterSelections,
  filterConditions,
  previewFilterSelection,
  findApplicableTransactions,
  recordFilterAuditEntries,
  listAppliedAuditKeys,
  listFilterAuditEntries,
  countFilterAuditEntriesByRule,
  type FilterAuditCounts,
  getYnabReference,
  PREVIEW_ROW_LIMIT,
} from './queries/filter-selections';
export type {
  FilterSelectionInput,
  FilterMatchRow,
  FilterPreview,
  ApplicableTransaction,
  ListFilterAuditOptions,
  YnabReference,
} from './queries/filter-selections';
