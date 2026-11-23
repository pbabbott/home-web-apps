import type { BudgetJob } from '@abbottland/budget-db';
import { applyFilterSelections } from './apply-filter-selections';
import { hello } from './hello';
import { ynabSync } from './ynab-sync';
import { ynabTransform } from './ynab-transform';
import type { OperationResult } from './operation-result';

export type OperationHandler = (job: BudgetJob) => Promise<OperationResult>;

/**
 * Registry keyed by job `operation`. Adding a job type means adding a
 * handler here and the matching branch in budget-api's createJobSchema.
 */
export const operationHandlers: Record<string, OperationHandler | undefined> = {
  hello,
  ynab_sync: ynabSync,
  ynab_transform: ynabTransform,
  apply_filter_selections: applyFilterSelections,
};
