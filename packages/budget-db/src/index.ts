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
