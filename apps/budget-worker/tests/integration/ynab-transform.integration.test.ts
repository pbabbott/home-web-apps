import { randomUUID } from 'crypto';
import {
  getYnabTransformState,
  listYnabRawResponses,
  recordYnabRawResponse,
  ynabAccounts,
  ynabPlans,
  ynabSubtransactions,
  ynabTransactions,
  ynabTransactionsEnriched,
  ynabPayees,
  type BudgetJob,
  type YnabEndpoint,
} from '@abbottland/budget-db';
import { db } from '../../src/db';
import { ynabTransform } from '../../src/worker/operations/ynab-transform';

// In-memory job, as in ynab-sync.integration.test.ts: no budget_jobs rows.
const run = (parameters: Record<string, unknown> = {}) =>
  ynabTransform({
    id: randomUUID(),
    operation: 'ynab_transform',
    parameters,
  } as BudgetJob);

const store = (
  planId: string,
  endpoint: YnabEndpoint,
  data: Record<string, unknown>,
  { from = null, to }: { from?: number | null; to: number },
) =>
  recordYnabRawResponse(db, {
    planId,
    endpoint,
    serverKnowledgeRequested: from,
    serverKnowledgeReturned: to,
    httpStatus: 200,
    payload: { data: { ...data, server_knowledge: to } },
  });

const txn = (
  id: string,
  amount: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  date: '2026-11-01',
  amount,
  cleared: 'cleared',
  approved: true,
  account_id: 'acct',
  payee_id: 'payee',
  category_id: null,
  deleted: false,
  ...extra,
});

const withoutTimestamps = <T extends { updatedAt: Date }>(rows: T[]) =>
  rows.map((row) => ({ ...row, updatedAt: undefined }));

const txnRows = async (planId: string) =>
  (await db.select().from(ynabTransactions))
    .filter((row) => row.planId === planId)
    .sort((a, b) => a.id.localeCompare(b.id));

describe('ynab_transform', () => {
  it('applies a snapshot, then is a no-op when nothing new arrived', async () => {
    const planId = 'plan-snapshot';
    await store(
      planId,
      'transactions',
      { transactions: [txn('t1', -1000), txn('t2', 500)] },
      { to: 1 },
    );

    const first = await run();
    expect(first.message).toContain('Applied 1 raw responses');
    expect(await txnRows(planId)).toMatchObject([
      { id: 't1', amount: -1000, deleted: false },
      { id: 't2', amount: 500 },
    ]);

    const [raw] = await listYnabRawResponses(db, {
      planId,
      endpoint: 'transactions',
    });
    expect(
      (await getYnabTransformState(db, planId, 'transactions'))
        ?.lastRawResponseId,
    ).toBe(raw.id);

    const second = await run();
    expect(second.message).toContain('Applied 0 raw responses');
    expect(await txnRows(planId)).toHaveLength(2);
  });

  it('applies deltas in order: updates, deletes and split-line replacement', async () => {
    const planId = 'plan-delta';
    await store(
      planId,
      'transactions',
      {
        transactions: [
          txn('t1', -1000),
          txn('t2', -500, {
            subtransactions: [
              { id: 's1', amount: -200 },
              { id: 's2', amount: -300 },
            ],
          }),
        ],
      },
      { to: 1 },
    );
    await run();

    await store(
      planId,
      'transactions',
      {
        transactions: [
          txn('t1', -1500),
          txn('t2', -500, { subtransactions: [{ id: 's3', amount: -500 }] }),
          txn('t3', 70, { deleted: true }),
        ],
      },
      { from: 1, to: 2 },
    );
    await run();

    expect(await txnRows(planId)).toMatchObject([
      { id: 't1', amount: -1500, deleted: false },
      { id: 't2', deleted: false },
      { id: 't3', deleted: true },
    ]);
    expect(
      (await db.select().from(ynabSubtransactions))
        .filter((row) => row.planId === planId)
        .map((row) => ({ id: row.id })),
    ).toEqual([{ id: 's3' }]);
  });

  it('marks entities missing from a later full snapshot as deleted', async () => {
    const planId = 'plan-resnapshot';
    await store(
      planId,
      'transactions',
      { transactions: [txn('t1', 1), txn('t2', 2)] },
      { to: 1 },
    );
    await run();
    await store(
      planId,
      'transactions',
      { transactions: [txn('t2', 2)] },
      { to: 5 },
    );
    await run();

    expect(await txnRows(planId)).toMatchObject([
      { id: 't1', deleted: true },
      { id: 't2', deleted: false },
    ]);
  });

  it('rebuild re-folds all raw rows into identical tables', async () => {
    const planId = 'plan-rebuild';
    await store(
      planId,
      'transactions',
      { transactions: [txn('t1', 10)] },
      { to: 1 },
    );
    await store(
      planId,
      'transactions',
      { transactions: [txn('t1', 20), txn('t2', 5)] },
      { from: 1, to: 2 },
    );
    await run();
    const before = withoutTimestamps(await txnRows(planId));

    const rebuilt = await run({ rebuild: true });
    expect(rebuilt.message).toContain('Rebuilt: applied');
    expect(withoutTimestamps(await txnRows(planId))).toEqual(before);
  });

  it('upserts plans and exposes names through ynab_transactions_enriched', async () => {
    const planId = 'plan-view';
    await recordYnabRawResponse(db, {
      endpoint: 'plans',
      httpStatus: 200,
      payload: { data: { plans: [{ id: planId, name: 'Household' }] } },
    });
    await store(
      planId,
      'accounts',
      {
        accounts: [
          {
            id: 'acct',
            name: 'Checking',
            type: 'checking',
            on_budget: true,
            closed: false,
            balance: 0,
            cleared_balance: 0,
            uncleared_balance: 0,
          },
        ],
      },
      { to: 1 },
    );
    await store(
      planId,
      'payees',
      { payees: [{ id: 'payee', name: 'Corner Store' }] },
      { to: 1 },
    );
    await store(
      planId,
      'transactions',
      { transactions: [txn('t1', -12340), txn('gone', 1, { deleted: true })] },
      { to: 1 },
    );
    await run();

    expect(
      (await db.select().from(ynabPlans)).filter((r) => r.id === planId),
    ).toMatchObject([{ name: 'Household' }]);
    expect(
      (await db.select().from(ynabPayees)).filter((r) => r.planId === planId),
    ).toHaveLength(1);

    const enriched = (await db.select().from(ynabTransactionsEnriched)).filter(
      (r) => r.planId === planId,
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0]).toMatchObject({
      id: 't1',
      accountName: 'Checking',
      payeeName: 'Corner Store',
      isTransfer: false,
      isSplit: false,
    });
    expect(Number(enriched[0].amountUnits)).toBeCloseTo(-12.34);
  });

  it('does not rewrite plans when no new plans response arrived', async () => {
    const planId = 'plan-unchanged';
    await recordYnabRawResponse(db, {
      endpoint: 'plans',
      httpStatus: 200,
      payload: { data: { plans: [{ id: planId, name: 'Same' }] } },
    });

    expect((await run()).message).toContain('(1 rows written)');
    expect((await run()).message).toBe(
      'Applied 0 raw responses (0 rows written).',
    );
  });

  it('rejects invalid parameters', async () => {
    await expect(run({ endpoints: ['plans'] })).rejects.toThrow('invalid');
  });

  // Last: the malformed raw row stays in the shared test DB and fails later runs.
  it('fails on a malformed payload with the raw id and leaves the watermark unmoved', async () => {
    const planId = 'plan-bad';
    await store(
      planId,
      'accounts',
      {
        accounts: [
          {
            id: 'a1',
            name: 'Ok',
            type: 'checking',
            on_budget: true,
            closed: false,
            balance: 1,
            cleared_balance: 1,
            uncleared_balance: 0,
          },
        ],
      },
      { to: 1 },
    );
    await run();
    const bad = await store(
      planId,
      'accounts',
      { accounts: [{ id: 'a2' }] },
      { from: 1, to: 2 },
    );
    const good = (
      await listYnabRawResponses(db, { planId, endpoint: 'accounts' })
    )[0];

    await expect(run()).rejects.toThrow(bad.id);
    expect(
      (await getYnabTransformState(db, planId, 'accounts'))?.lastRawResponseId,
    ).toBe(good.id);
    expect(
      (await db.select().from(ynabAccounts)).filter((r) => r.planId === planId),
    ).toHaveLength(1);
  });
});
