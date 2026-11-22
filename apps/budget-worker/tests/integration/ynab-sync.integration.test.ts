import { randomUUID } from 'crypto';
import {
  getYnabSyncState,
  listYnabRawResponses,
  type BudgetJob,
} from '@abbottland/budget-db';
import { ynabGet, YnabApiError } from '../../src/api/ynab/ynab-client';
import { config } from '../../src/config';
import { db } from '../../src/db';
import { ynabSync } from '../../src/worker/operations/ynab-sync';

jest.mock('../../src/api/ynab/ynab-client', () => ({
  ...jest.requireActual('../../src/api/ynab/ynab-client'),
  ynabGet: jest.fn(),
}));

const ynabGetMock = ynabGet as jest.Mock;

const ok = (data: Record<string, unknown>, serverKnowledge?: number) => ({
  status: 200,
  body: { data: { ...data, server_knowledge: serverKnowledge } },
  serverKnowledge: serverKnowledge ?? null,
  rateLimit: { used: 3, total: 200 },
});

// In-memory job: ynab_sync only reads job.id/parameters, and inserting rows
// into budget_jobs would leave pending jobs behind for the poll-loop test to
// claim (it claims the oldest pending job).
const newJob = async (
  parameters: Record<string, unknown> = {},
): Promise<BudgetJob> =>
  ({
    id: randomUUID(),
    operation: 'ynab_sync',
    parameters,
  }) as BudgetJob;

describe('ynab_sync', () => {
  beforeAll(() => {
    config.ynab = { apiUrl: 'https://ynab.test/v1', apiToken: 'tok' };
  });

  beforeEach(() => ynabGetMock.mockReset());

  it('stores full snapshots first, then sends the cursor and appends deltas', async () => {
    ynabGetMock.mockImplementation(async (path: string) =>
      path === '/plans'
        ? ok({ plans: [{ id: 'plan-a' }] })
        : ok({ [path.split('/').pop()!]: [] }, 10),
    );

    const first = await ynabSync(await newJob({ endpoints: ['transactions'] }));
    expect(first.message).toContain('Stored 2 raw responses in 2 requests');

    const afterFirst = await listYnabRawResponses(db, {
      planId: 'plan-a',
      endpoint: 'transactions',
    });
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].serverKnowledgeRequested).toBeNull();
    expect(afterFirst[0].serverKnowledgeReturned).toBe(10);
    expect(
      (await getYnabSyncState(db, 'plan-a', 'transactions'))?.serverKnowledge,
    ).toBe(10);

    ynabGetMock.mockImplementation(async (path: string) =>
      path === '/plans'
        ? ok({ plans: [{ id: 'plan-a' }] })
        : ok({ transactions: [{ id: 't1' }] }, 12),
    );

    await ynabSync(await newJob({ endpoints: ['transactions'] }));

    expect(ynabGetMock).toHaveBeenLastCalledWith('/plans/plan-a/transactions', {
      lastKnowledge: 10,
    });
    const afterSecond = await listYnabRawResponses(db, {
      planId: 'plan-a',
      endpoint: 'transactions',
    });
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond[1].serverKnowledgeRequested).toBe(10);
    expect(
      (await getYnabSyncState(db, 'plan-a', 'transactions'))?.serverKnowledge,
    ).toBe(12);
  });

  it('does not advance the cursor when a fetch fails', async () => {
    ynabGetMock.mockImplementation(async (path: string) => {
      if (path === '/plans') return ok({ plans: [{ id: 'plan-b' }] });
      throw new YnabApiError(500, 'boom');
    });

    await expect(
      ynabSync(await newJob({ endpoints: ['accounts'] })),
    ).rejects.toThrow('boom');

    expect(await getYnabSyncState(db, 'plan-b', 'accounts')).toBeUndefined();
  });

  it('stops cleanly and reports what was skipped on a 429', async () => {
    ynabGetMock.mockImplementation(async (path: string) => {
      if (path === '/plans') return ok({ plans: [{ id: 'plan-c' }] });
      throw new YnabApiError(429, 'slow down');
    });

    const result = await ynabSync(
      await newJob({ planIds: ['plan-c'], endpoints: ['accounts'] }),
    );

    expect(result.message).toContain('stopped early');
    expect(result.message).toContain('429');
  });

  it('fails the job when the token is not configured', async () => {
    config.ynab = {
      apiUrl: 'https://ynab.test/v1',
      apiToken: 'not-configured',
    };

    await expect(ynabSync(await newJob())).rejects.toThrow(
      'YNAB_API_TOKEN is not configured',
    );

    config.ynab = { apiUrl: 'https://ynab.test/v1', apiToken: 'tok' };
  });
});
