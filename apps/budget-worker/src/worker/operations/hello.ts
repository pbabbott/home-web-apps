import type { BudgetJob } from '@abbottland/budget-db';
import type { OperationResult } from './operation-result';

/** Hello-world operation: placeholder showing the shape of a handler. */
export const hello = async (job: BudgetJob): Promise<OperationResult> => {
  const { name } = job.parameters as { name?: string };

  return { message: `Hello, ${name ?? 'world'}!` };
};
