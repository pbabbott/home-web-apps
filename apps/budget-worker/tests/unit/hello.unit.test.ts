import type { BudgetJob } from '@abbottland/budget-db';
import { hello } from '../../src/worker/operations/hello';

const job = (parameters: Record<string, unknown>) =>
  ({ id: 'job-1', operation: 'hello', parameters }) as BudgetJob;

describe('hello operation', () => {
  it('greets the given name', async () => {
    await expect(hello(job({ name: 'Brandon' }))).resolves.toEqual({
      message: 'Hello, Brandon!',
    });
  });

  it('defaults to world', async () => {
    await expect(hello(job({}))).resolves.toEqual({
      message: 'Hello, world!',
    });
  });
});
