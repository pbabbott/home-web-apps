import type { BudgetJob } from '@abbottland/budget-db';
import { hello } from './hello';
import type { OperationResult } from './operation-result';

export type OperationHandler = (job: BudgetJob) => Promise<OperationResult>;

/**
 * Registry keyed by job `operation`. Adding a job type means adding a
 * handler here and the matching branch in budget-api's createJobSchema.
 */
export const operationHandlers: Record<string, OperationHandler | undefined> = {
  hello,
};
