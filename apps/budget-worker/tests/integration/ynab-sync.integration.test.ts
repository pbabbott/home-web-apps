import { randomUUID } from 'crypto';
import {
  getYnabSyncState,
  listYnabPlans,
  listYnabRawResponses,
  listYnabSyncRuns,
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

const useConfig = (planId: string, apiToken = 'tok') => {
  config.ynab = { apiUrl: 'https://ynab.test/v1', apiToken, planId };
};

/** /plans lists these plans; every other path returns an empty delta. */
const mockYnab = (
  plans: { id: string; name?: string }[],
  serverKnowledge = 10,
) =>
  ynabGetMock.mockImplementation(async (path: string) =>
    path === '/plans'
      ? ok({ plans })
      : ok({ [path.split('/').pop()!]: [] }, serverKnowledge),
  );

describe('ynab_sync', () => {
  beforeEach(() => ynabGetMock.mockReset());

  it('stores full snapshots first, then sends the cursor and appends deltas', async () => {
    useConfig('plan-a');
    mockYnab([{ id: 'plan-a', name: 'Plan A' }]);

    const first = await ynabSync(await newJob({ endpoints: ['transactions'] }));
    expect(first.message).toContain('Stored 2 raw responses in 2 requests');
    expect(await listYnabPlans(db)).toEqual([{ id: 'plan-a', name: 'Plan A' }]);
    expect((await listYnabSyncRuns(db))[0]).toMatchObject({
      responses: 2,
      snapshots: 1,
      deltas: 0,
    });

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

    mockYnab([{ id: 'plan-a', name: 'Plan A' }], 12);

    await ynabSync(await newJob({ endpoints: ['transactions'] }));

    expect((await listYnabSyncRuns(db))[0]).toMatchObject({
      responses: 2,
      snapshots: 0,
      deltas: 1,
    });
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
    useConfig('plan-b');
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
    useConfig('plan-c');
    ynabGetMock.mockImplementation(async (path: string) => {
      if (path === '/plans') return ok({ plans: [{ id: 'plan-c' }] });
      throw new YnabApiError(429, 'slow down');
    });

    const result = await ynabSync(await newJob({ endpoints: ['accounts'] }));

    expect(result.message).toContain('stopped early');
    expect(result.message).toContain('429');
  });

  it('syncs only the configured plan, even when the token sees several', async () => {
    useConfig('plan-only');
    mockYnab([{ id: 'plan-other' }, { id: 'plan-only' }], 3);

    const result = await ynabSync(await newJob({ endpoints: ['accounts'] }));

    expect(result.message).toContain('Stored 2 raw responses in 2 requests');
    expect(ynabGetMock).toHaveBeenCalledWith('/plans/plan-only/accounts', {
      lastKnowledge: null,
    });
    expect(ynabGetMock).not.toHaveBeenCalledWith(
      '/plans/plan-other/accounts',
      expect.anything(),
    );
    expect(
      await getYnabSyncState(db, 'plan-other', 'accounts'),
    ).toBeUndefined();
  });

  it('a full sync still only touches the configured plan', async () => {
    useConfig('plan-only');
    mockYnab([{ id: 'plan-other' }, { id: 'plan-only' }], 5);

    const result = await ynabSync(await newJob({ full: true }));

    // 1 plan list + 6 plan-scoped endpoints for the one plan.
    expect(result.message).toContain('Stored 7 raw responses in 7 requests');
    const paths = ynabGetMock.mock.calls.map(([path]) => path as string);
    expect(paths.filter((p) => p.includes('plan-other'))).toEqual([]);
    expect(paths.filter((p) => p.startsWith('/plans/plan-only/'))).toHaveLength(
      6,
    );
    for (const [, options] of ynabGetMock.mock.calls.slice(1)) {
      expect(options.lastKnowledge).toBeNull();
    }
  });

  it('ignores a planIds job parameter smuggled in by a caller', async () => {
    useConfig('plan-only');
    mockYnab([{ id: 'plan-other' }, { id: 'plan-only' }], 5);

    await ynabSync(
      await newJob({ planIds: ['plan-other'], endpoints: ['accounts'] }),
    );

    expect(ynabGetMock).not.toHaveBeenCalledWith(
      '/plans/plan-other/accounts',
      expect.anything(),
    );
  });

  it('fails when the configured plan is not visible to the token', async () => {
    useConfig('plan-missing');
    mockYnab([{ id: 'x' }]);

    await expect(ynabSync(await newJob())).rejects.toThrow(
      'YNAB plan not found for this token: plan-missing',
    );
  });

  it('fails the job when no plan is configured', async () => {
    useConfig('not-configured');

    await expect(ynabSync(await newJob())).rejects.toThrow(
      'YNAB_PLAN_ID is not configured',
    );
    expect(ynabGetMock).not.toHaveBeenCalled();
  });

  it('fails the job when the token is not configured', async () => {
    useConfig('plan-a', 'not-configured');

    await expect(ynabSync(await newJob())).rejects.toThrow(
      'YNAB_API_TOKEN is not configured',
    );
    expect(ynabGetMock).not.toHaveBeenCalled();
  });
});
