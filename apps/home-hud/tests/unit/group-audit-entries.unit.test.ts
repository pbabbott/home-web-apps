import type { FilterAuditEntry } from '../../src/app/budget/lib/budget-api';
import { groupAuditEntries } from '../../src/app/budget/audit/group-audit-entries';

const entry = (o: Partial<FilterAuditEntry>): FilterAuditEntry => ({
  id: Math.random().toString(),
  appliedAt: '2026-11-23T10:00:00Z',
  jobId: 'j1',
  filterSelectionId: 'r1',
  ruleName: 'Rule',
  ruleDescription: 'desc',
  planId: 'p',
  transactionId: 't1',
  transactionDate: '2026-11-20',
  transactionAmount: -5000,
  accountName: 'Checking',
  payeeName: 'Shop',
  action: 'categorize',
  fromValue: 'uncategorized',
  toValue: 'Groceries',
  status: 'applied',
  error: null,
  ...o,
});

describe('groupAuditEntries', () => {
  it('merges categorize and approve rows of one transaction', () => {
    const g = groupAuditEntries([
      entry({
        action: 'approve',
        fromValue: 'unapproved',
        toValue: 'approved',
      }),
      entry({}),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].categorize?.toValue).toBe('Groceries');
    expect(g[0].approve?.toValue).toBe('approved');
  });

  it('keeps different transactions and jobs apart, in input order', () => {
    const g = groupAuditEntries([
      entry({ transactionId: 't2' }),
      entry({}),
      entry({ jobId: 'j0' }),
    ]);
    expect(g.map((x) => x.base.transactionId)).toEqual(['t2', 't1', 't1']);
  });

  it('takes the worst status', () => {
    const g = groupAuditEntries([
      entry({ status: 'skipped_conflict' }),
      entry({ action: 'approve', status: 'failed' }),
      entry({ action: 'approve', status: 'applied', id: 'x' }),
    ]);
    expect(g[0].status).toBe('failed');
  });

  it('does not let an unchanged row mask an applied one', () => {
    const g = groupAuditEntries([
      entry({ status: 'unchanged', fromValue: 'Groceries' }),
      entry({
        action: 'approve',
        fromValue: 'unapproved',
        toValue: 'approved',
      }),
    ]);
    expect(g[0].status).toBe('applied');
  });

  it('falls back to appliedAt when jobId is null', () => {
    const g = groupAuditEntries([
      entry({ jobId: null }),
      entry({ jobId: null, action: 'approve' }),
      entry({ jobId: null, appliedAt: '2026-11-22T10:00:00Z' }),
    ]);
    expect(g).toHaveLength(2);
  });
});
