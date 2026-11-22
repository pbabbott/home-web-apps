import {
  mappers,
  mapPlans,
} from '../../src/worker/operations/ynab-transform/mappers';

const ctx = { planId: 'plan-a', rawResponseId: 'raw-1' };

describe('ynab_transform mappers', () => {
  it('maps plans', () => {
    expect(
      mapPlans(
        {
          data: {
            plans: [
              {
                id: 'p1',
                name: 'Home',
                last_modified_on: '2026-01-02T03:04:05Z',
              },
            ],
          },
        },
        'raw-9',
      ),
    ).toMatchObject([{ id: 'p1', name: 'Home', lastRawResponseId: 'raw-9' }]);
  });

  it('maps accounts with lineage and the deleted flag', () => {
    const { accounts } = mappers.accounts(
      {
        data: {
          accounts: [
            {
              id: 'a1',
              name: 'Checking',
              type: 'checking',
              on_budget: true,
              closed: false,
              balance: 12340,
              cleared_balance: 12000,
              uncleared_balance: 340,
              deleted: true,
            },
          ],
        },
      },
      ctx,
    );

    expect(accounts).toMatchObject([
      {
        planId: 'plan-a',
        id: 'a1',
        balance: 12340,
        deleted: true,
        lastRawResponseId: 'raw-1',
      },
    ]);
  });

  it('flattens categories under their groups', () => {
    const rows = mappers.categories(
      {
        data: {
          category_groups: [
            {
              id: 'g1',
              name: 'Bills',
              hidden: false,
              deleted: false,
              categories: [
                {
                  id: 'c1',
                  name: 'Rent',
                  hidden: false,
                  budgeted: 1000,
                  activity: -1000,
                  balance: 0,
                },
              ],
            },
          ],
        },
      },
      ctx,
    );

    expect(rows.categoryGroups).toHaveLength(1);
    expect(rows.categories).toMatchObject([
      { id: 'c1', categoryGroupId: 'g1', name: 'Rent' },
    ]);
  });

  it('maps transactions and their split lines', () => {
    const rows = mappers.transactions(
      {
        data: {
          transactions: [
            {
              id: 't1',
              date: '2026-11-01',
              amount: -5000,
              cleared: 'cleared',
              approved: true,
              account_id: 'a1',
              payee_id: null,
              subtransactions: [
                { id: 's1', amount: -2000, category_id: 'c1' },
                { id: 's2', amount: -3000, category_id: 'c2' },
              ],
            },
          ],
        },
      },
      ctx,
    );

    expect(rows.transactions).toMatchObject([
      { id: 't1', amount: -5000, payeeId: null },
    ]);
    expect(rows.subtransactions).toMatchObject([
      { id: 's1', transactionId: 't1', amount: -2000 },
      { id: 's2', transactionId: 't1', amount: -3000 },
    ]);
  });

  it('maps months with per-month category rows', () => {
    const rows = mappers.months(
      {
        data: {
          months: [
            {
              month: '2026-11-01',
              income: 100,
              budgeted: 90,
              activity: -50,
              to_be_budgeted: 10,
              categories: [
                { id: 'c1', budgeted: 90, activity: -50, balance: 40 },
              ],
            },
          ],
        },
      },
      ctx,
    );

    expect(rows.months).toMatchObject([
      { month: '2026-11-01', toBeBudgeted: 10 },
    ]);
    expect(rows.monthCategories).toMatchObject([
      { month: '2026-11-01', categoryId: 'c1', balance: 40 },
    ]);
  });

  it('maps scheduled transactions and payees', () => {
    expect(
      mappers.scheduled_transactions(
        {
          data: {
            scheduled_transactions: [
              {
                id: 'st1',
                date_first: '2026-01-01',
                date_next: '2026-12-01',
                frequency: 'monthly',
                amount: -100,
                account_id: 'a1',
                subtransactions: [{ id: 'ss1', amount: -100 }],
              },
            ],
          },
        },
        ctx,
      ).scheduledSubtransactions,
    ).toMatchObject([{ id: 'ss1', scheduledTransactionId: 'st1' }]);

    expect(
      mappers.payees({ data: { payees: [{ id: 'p1', name: 'Store' }] } }, ctx)
        .payees,
    ).toMatchObject([{ id: 'p1', name: 'Store', transferAccountId: null }]);
  });

  it('returns no rows for a response with nothing in it', () => {
    expect(mappers.transactions({ data: { transactions: [] } }, ctx)).toEqual({
      transactions: [],
      subtransactions: [],
    });
    expect(mappers.accounts({}, ctx)).toEqual({ accounts: [] });
  });

  it('throws on a missing required field', () => {
    expect(() =>
      mappers.payees({ data: { payees: [{ id: 'p1' }] } }, ctx),
    ).toThrow('"name"');
  });
});
