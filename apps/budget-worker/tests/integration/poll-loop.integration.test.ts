import {
  claimNextBudgetJob,
  createBudgetJob,
  getBudgetJobById,
} from '@abbottland/budget-db';
import { db } from '../../src/db';
import { processJob } from '../../src/worker/job-processor';

// Exercises claimNextBudgetJob + processJob directly rather than the poll
// loop's pollOnce(), which self-reschedules via a real setTimeout — fine for
// the always-running service, but it would race ahead into later tests here.
describe('claim -> process round trip', () => {
  it('claims a pending hello job, processes it and completes it', async () => {
    const created = await createBudgetJob(db, {
      operation: 'hello',
      parameters: { name: 'test' },
    });

    const claimed = await claimNextBudgetJob(db, 'test-worker');
    expect(claimed?.id).toBe(created.id);

    await processJob(claimed!);

    const job = await getBudgetJobById(db, created.id);

    expect(job?.status).toBe('completed');
    expect(job?.message).toBe('Hello, test!');
    expect(job?.workerId).toBe('test-worker');
  });

  it('fails a job whose operation has no handler', async () => {
    const created = await createBudgetJob(db, {
      operation: 'nope',
      parameters: {},
    });

    const claimed = await claimNextBudgetJob(db, 'test-worker');
    expect(claimed?.id).toBe(created.id);

    jest.spyOn(console, 'error').mockImplementation();
    await processJob(claimed!);

    const job = await getBudgetJobById(db, created.id);

    expect(job?.status).toBe('failed');
    expect(job?.error).toContain('unsupported operation');
  });
});
