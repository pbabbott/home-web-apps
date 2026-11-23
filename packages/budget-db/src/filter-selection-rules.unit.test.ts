import {
  auditKey,
  describeRule,
  formatMilliunits,
  hasAction,
  hasFilter,
  payeeLikePattern,
  resolveMatches,
  type FilterSelectionRule,
} from './filter-selection-rules';

const rule = (
  id: string,
  extra: Partial<FilterSelectionRule> = {},
): FilterSelectionRule => ({
  id,
  name: `rule-${id}`,
  planId: 'plan',
  accountId: null,
  payeeId: null,
  payeeMatchType: null,
  payeePattern: null,
  amountMinMilliunits: null,
  amountMaxMilliunits: null,
  categoryId: null,
  autoApprove: false,
  ...extra,
});

describe('describeRule', () => {
  it('freezes names, amount range and actions into text', () => {
    const text = describeRule(
      rule('1', {
        name: 'Mortgage',
        accountId: 'a',
        payeeId: 'p',
        amountMinMilliunits: -2_500_000,
        amountMaxMilliunits: -2_000_000,
        categoryId: 'c',
        autoApprove: true,
      }),
      {
        accountName: 'Checking',
        payeeName: 'Mortgage Co',
        categoryName: 'Rent/Mortgage',
      },
    );

    expect(text).toBe(
      'Mortgage: account "Checking" AND payee "Mortgage Co" AND amount -2,500.00 to -2,000.00 -> categorize "Rent/Mortgage", approve',
    );
  });

  it('handles one-sided ranges and falls back to ids', () => {
    expect(
      describeRule(
        rule('1', {
          name: 'N',
          payeeId: 'p1',
          amountMinMilliunits: 5000,
          autoApprove: true,
        }),
      ),
    ).toBe('N: payee "p1" AND amount >= 5.00 -> approve');
    expect(
      describeRule(
        rule('1', { name: 'N', amountMaxMilliunits: -1000, categoryId: 'c9' }),
      ),
    ).toBe('N: amount <= -1.00 -> categorize "c9"');
  });
});

describe('hasFilter / hasAction', () => {
  it('requires at least one of each', () => {
    expect(hasFilter(rule('1'))).toBe(false);
    expect(hasFilter(rule('1', { amountMaxMilliunits: 0 }))).toBe(true);
    expect(hasAction(rule('1'))).toBe(false);
    expect(hasAction(rule('1', { autoApprove: true }))).toBe(true);
    expect(hasAction(rule('1', { categoryId: 'c' }))).toBe(true);
  });
});

describe('formatMilliunits', () => {
  it('formats signed units', () => {
    expect(formatMilliunits(-12340)).toBe('-12.34');
  });
});

describe('resolveMatches', () => {
  it('merges approve flags and category from non-conflicting rules', () => {
    const cat = rule('a', { categoryId: 'c1' });
    const approve = rule('b', { autoApprove: true });
    const { changes, conflicts } = resolveMatches([
      { transactionId: 't1', rule: cat },
      { transactionId: 't1', rule: approve },
      { transactionId: 't2', rule: approve },
    ]);

    expect(conflicts).toEqual([]);
    expect(changes).toMatchObject([
      { transactionId: 't1', categoryId: 'c1', approve: true },
      { transactionId: 't2', categoryId: null, approve: true },
    ]);
    expect(changes[0].categorizedBy).toBe(cat);
    expect(changes[0].approvedBy).toBe(approve);
  });

  it('skips a transaction whose rules want different categories', () => {
    const { changes, conflicts } = resolveMatches([
      { transactionId: 't1', rule: rule('a', { categoryId: 'c1' }) },
      {
        transactionId: 't1',
        rule: rule('b', { categoryId: 'c2', autoApprove: true }),
      },
    ]);

    expect(changes).toEqual([]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rules.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('treats two rules with the same category as no conflict', () => {
    const { changes, conflicts } = resolveMatches([
      { transactionId: 't1', rule: rule('a', { categoryId: 'c1' }) },
      { transactionId: 't1', rule: rule('b', { categoryId: 'c1' }) },
    ]);

    expect(conflicts).toEqual([]);
    expect(changes).toHaveLength(1);
  });
});

describe('auditKey', () => {
  it('is stable', () => {
    expect(auditKey('t', 'approve', null)).toBe('t|approve|');
  });
});

describe('payee text matching', () => {
  it('builds ILIKE patterns for each match type', () => {
    expect(payeeLikePattern('starts_with', 'Royal')).toBe('Royal%');
    expect(payeeLikePattern('contains', 'Royal')).toBe('%Royal%');
    expect(payeeLikePattern('ends_with', 'Bank')).toBe('%Bank');
    expect(payeeLikePattern('equals', 'Royal')).toBe('Royal');
  });

  it('escapes wildcard characters so they match literally', () => {
    expect(payeeLikePattern('contains', '50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });

  it('counts a pattern as a filter and describes it', () => {
    const r = rule('1', {
      payeeMatchType: 'starts_with',
      payeePattern: 'Royal',
      categoryId: 'c',
    });

    expect(hasFilter(r)).toBe(true);
    expect(describeRule(r)).toBe(
      'rule-1: payee starts with "Royal" -> categorize "c"',
    );
  });
});
