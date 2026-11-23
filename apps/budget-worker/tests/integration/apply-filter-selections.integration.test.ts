import { randomUUID } from 'crypto';
import {
  budgetFilterSelectionAudit,
  budgetFilterSelections,
  budgetJobs,
  createFilterSelection,
  listFilterAuditEntries,
  previewFilterSelection,
  updateFilterSelection,
  ynabAccounts,
  ynabCategories,
  ynabCategoryGroups,
  ynabPayees,
  ynabSubtransactions,
  ynabTransactions,
  type BudgetJob,
} from '@abbottland/budget-db';
import { ynabPatch, YnabApiError } from '../../src/api/ynab/ynab-client';
import { config } from '../../src/config';
import { db } from '../../src/db';
import { applyFilterSelections } from '../../src/worker/operations/apply-filter-selections';

jest.mock('../../src/api/ynab/ynab-client', () => ({
  ...jest.requireActual('../../src/api/ynab/ynab-client'),
  ynabPatch: jest.fn(),
}));

const ynabPatchMock = ynabPatch as jest.Mock;
const planId = 'plan-apply';
const raw = randomUUID();
const lineage = { deleted: false, lastRawResponseId: raw };

const run = (parameters: Record<string, unknown> = {}) =>
  applyFilterSelections({
    id: randomUUID(),
    operation: 'apply_filter_selections',
    parameters,
  } as BudgetJob);

const txn = (
  id: string,
  amount: number,
  extra: Partial<typeof ynabTransactions.$inferInsert> = {},
): typeof ynabTransactions.$inferInsert => ({
  planId,
  id,
  date: '2026-11-01',
  amount,
  cleared: 'cleared',
  approved: false,
  accountId: 'acct',
  payeeId: 'payee',
  categoryId: null,
  ...lineage,
  ...extra,
});

const rule = (extra: Record<string, unknown> = {}) =>
  createFilterSelection(db, {
    name: 'Mortgage',
    planId,
    accountId: 'acct',
    payeeId: 'payee',
    amountMinMilliunits: -2_500_000,
    amountMaxMilliunits: -2_000_000,
    categoryId: 'cat-rent',
    autoApprove: true,
    ...extra,
  });

const auditFor = async (transactionId: string) =>
  (await listFilterAuditEntries(db)).filter(
    (e) => e.transactionId === transactionId,
  );

describe('apply_filter_selections', () => {
  beforeAll(async () => {
    await db.insert(ynabAccounts).values({
      planId,
      id: 'acct',
      name: 'Checking',
      type: 'checking',
      onBudget: true,
      closed: false,
      balance: 0,
      clearedBalance: 0,
      unclearedBalance: 0,
      ...lineage,
    });
    await db
      .insert(ynabPayees)
      .values({ planId, id: 'payee', name: 'Mortgage Co', ...lineage });
    await db.insert(ynabCategoryGroups).values({
      planId,
      id: 'grp',
      name: 'Bills',
      hidden: false,
      ...lineage,
    });
    await db.insert(ynabCategories).values(
      ['cat-rent', 'cat-other'].map((id) => ({
        planId,
        id,
        categoryGroupId: 'grp',
        name: id === 'cat-rent' ? 'Rent/Mortgage' : 'Other',
        hidden: false,
        budgeted: 0,
        activity: 0,
        balance: 0,
        ...lineage,
      })),
    );
  });

  beforeEach(async () => {
    config.ynab = {
      apiUrl: 'https://ynab.test/v1',
      apiToken: 'token',
      planId,
    };
    ynabPatchMock.mockReset();
    ynabPatchMock.mockResolvedValue({ status: 200, body: {}, rateLimit: null });
    await db.delete(budgetFilterSelectionAudit);
    await db.delete(budgetFilterSelections);
    await db.delete(ynabSubtransactions);
    await db.delete(ynabTransactions);
    await db.delete(budgetJobs);
  });

  it('categorizes and approves only eligible transactions, with audit rows', async () => {
    await db
      .insert(ynabTransactions)
      .values([
        txn('hit', -2_200_000),
        txn('out-of-range', -50_000),
        txn('already-approved', -2_200_000, { approved: true }),
        txn('transfer', -2_200_000, { transferAccountId: 'other' }),
        txn('categorized', -2_300_000, { categoryId: 'cat-other' }),
      ]);
    await db.insert(ynabSubtransactions).values({
      planId,
      id: 's1',
      transactionId: 'split',
      amount: -1,
      ...lineage,
    });
    await db.insert(ynabTransactions).values(txn('split', -2_100_000));
    await db.insert(ynabSubtransactions).values({
      planId,
      id: 's2',
      transactionId: 'split',
      amount: -2,
      ...lineage,
    });
    const r = await rule();

    const result = await run();

    expect(result.message).toContain('Applied 3 actions across 2 transactions');
    expect(ynabPatchMock).toHaveBeenCalledTimes(1);
    expect(ynabPatchMock).toHaveBeenCalledWith(
      `/plans/${planId}/transactions`,
      {
        transactions: expect.arrayContaining([
          { id: 'hit', category_id: 'cat-rent', approved: true },
          // already categorized: approve only
          { id: 'categorized', approved: true },
        ]),
      },
    );

    const hit = await auditFor('hit');

    expect(hit.map((e) => e.action).sort()).toEqual(['approve', 'categorize']);
    expect(hit.every((e) => e.status === 'applied')).toBe(true);
    expect(hit[0].ruleDescription).toBe(
      'Mortgage: account "Checking" AND payee "Mortgage Co" AND amount -2,500.00 to -2,000.00 -> categorize "Rent/Mortgage", approve',
    );
    expect(hit[0].filterSelectionId).toBe(r.id);
    expect(await auditFor('out-of-range')).toHaveLength(0);
    expect(await auditFor('split')).toHaveLength(0);
    expect(await auditFor('transfer')).toHaveLength(0);
    expect((await auditFor('categorized')).map((e) => e.action)).toEqual([
      'approve',
    ]);

    const jobs = await db.select().from(budgetJobs);

    expect(jobs).toMatchObject([
      { operation: 'ynab_sync', parameters: { endpoints: ['transactions'] } },
    ]);
  });

  it('is a no-op on a second run while typed tables are stale', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    await rule();

    await run();
    ynabPatchMock.mockClear();
    await db.delete(budgetJobs);

    const second = await run();

    expect(second.message).toContain('Applied 0 actions');
    expect(ynabPatchMock).not.toHaveBeenCalled();
    expect(await db.select().from(budgetJobs)).toHaveLength(0);
    expect(await auditFor('hit')).toHaveLength(2);
  });

  it('keeps the frozen rule text when the rule is edited afterwards', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    const r = await rule();

    await run();
    await updateFilterSelection(db, r.id, {
      name: 'Mortgage v2',
      planId,
      amountMinMilliunits: -9_000_000,
      autoApprove: true,
    });

    const [entry] = await auditFor('hit');

    expect(entry.ruleName).toBe('Mortgage');
    expect(entry.ruleDescription).toContain('-2,500.00 to -2,000.00');
  });

  it('skips a transaction matched by rules with different categories and logs it', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    await rule();
    await rule({ name: 'Other rule', categoryId: 'cat-other' });

    const result = await run();

    expect(result.message).toContain(
      '1 transactions skipped for conflicting rules',
    );
    expect(ynabPatchMock).not.toHaveBeenCalled();
    expect((await auditFor('hit')).map((e) => e.status)).toEqual([
      'skipped_conflict',
      'skipped_conflict',
    ]);
  });

  it('ignores disabled rules', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    await rule({ enabled: false });

    expect((await run()).message).toBe('No enabled filter selections.');
    expect(ynabPatchMock).not.toHaveBeenCalled();
  });

  it('records failed entries and fails the job when YNAB rejects the patch', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    await rule();
    ynabPatchMock.mockRejectedValue(new YnabApiError(400, 'bad request'));

    await expect(run()).rejects.toThrow('apply_filter_selections failed');
    expect((await auditFor('hit')).map((e) => e.status)).toEqual([
      'failed',
      'failed',
    ]);
    expect(await db.select().from(budgetJobs)).toHaveLength(0);
  });

  it('stops cleanly without audit rows when rate limited', async () => {
    await db.insert(ynabTransactions).values(txn('hit', -2_200_000));
    await rule();
    ynabPatchMock.mockRejectedValue(new YnabApiError(429, 'slow down'));

    const result = await run();

    expect(result.message).toContain('Stopped early');
    expect(await auditFor('hit')).toHaveLength(0);
  });

  it('refuses to run without a YNAB token', async () => {
    config.ynab = { ...config.ynab, apiToken: 'not-configured' };

    await expect(run()).rejects.toThrow('YNAB_API_TOKEN is not configured');
  });

  it('rejects parameters', async () => {
    await expect(run({ x: 1 })).rejects.toThrow('invalid');
  });

  it('preview matches the transactions apply would act on', async () => {
    await db
      .insert(ynabTransactions)
      .values([
        txn('hit', -2_200_000),
        txn('done', -2_200_000, { approved: true }),
        txn('miss', 5_000),
      ]);
    const r = await rule();

    const preview = await previewFilterSelection(db, planId, r);

    expect(preview.matched).toBe(2);
    expect(preview.actionable).toBe(1);
    expect(preview.rows.map((x) => x.id).sort()).toEqual(['done', 'hit']);
    expect(preview.rows[0]).toMatchObject({ accountName: 'Checking' });
  });
});
