import {
  anchorDay,
  normalizePayee,
  scoreCandidates,
  type CandidateSourceRow,
} from './candidate-scoring';

const row = (
  payeeName: string,
  date: string,
  amountUnits: number,
  extra: Partial<CandidateSourceRow> = {},
): CandidateSourceRow => ({
  payeeId: payeeName,
  payeeName,
  date,
  amountUnits,
  approved: false,
  categoryName: null,
  ...extra,
});

const monthly = (
  payee: string,
  days: number[],
  amounts: number[],
  startMonth = 1,
) =>
  days.map((d, i) =>
    row(
      payee,
      `2026-${String(startMonth + i).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      amounts[i],
    ),
  );

describe('normalizePayee', () => {
  it('merges Royal Credit Uni variants', () => {
    const keys = [
      'Royal Credit Uni CK-WTH PPD ID: 291880411',
      'Royal Credit Uni SAV-WTH PPD ID: 291880411',
    ].map(normalizePayee);

    expect(new Set(keys)).toEqual(new Set(['royal credit uni']));
  });

  it('strips store numbers', () => {
    expect(normalizePayee('Speedway #1234')).toBe('speedway');
  });
});

describe('anchorDay', () => {
  it('picks the day the group clusters around', () => {
    expect(anchorDay([4, 6, 4, 4, 5, 4])).toBe(4);
  });
});

describe('scoreCandidates', () => {
  const loan = monthly(
    'Student Loan',
    [4, 6, 4, 4, 5, 4],
    Array(6).fill(-372.91),
  );
  const mutual = monthly(
    'Northwestern Mutual',
    [10, 10, 11, 10, 10, 10],
    [-805.28, -805.28, -806.43, -805.28, -805.28, -805.28],
  );
  const gas = [
    row('Speedway', '2026-01-03', -40),
    row('Speedway', '2026-01-17', -60),
    row('Speedway', '2026-02-09', -90),
    row('Speedway', '2026-02-25', -45),
    row('Speedway', '2026-03-02', -70),
    row('Speedway', '2026-03-21', -55),
  ];
  const royal = [
    row('Royal Credit Uni CK-WTH PPD ID: 291880411', '2026-01-15', -100, {
      payeeId: 'a',
    }),
    row('Royal Credit Uni SAV-WTH PPD ID: 291880411', '2026-02-15', -100, {
      payeeId: 'b',
    }),
    row('Royal Credit Uni SAV-WTH PPD ID: 291880411', '2026-03-15', -100, {
      payeeId: 'b',
    }),
  ];

  const result = scoreCandidates([...gas, ...mutual, ...loan, ...royal]);
  const by = (k: string) => result.find((c) => c.key === k)!;

  it('ranks fixed bills high and gas low', () => {
    expect(by('student loan').confidence).toBe('high');
    expect(by('northwestern mutual').confidence).toBe('high');
    expect(by('speedway').confidence).toBe('low');
    expect(result.map((c) => c.key).indexOf('speedway')).toBe(
      result.length - 1,
    );
    expect(by('student loan').score).toBeGreaterThanOrEqual(
      by('northwestern mutual').score,
    );
  });

  it('merges payee spellings', () => {
    const r = by('royal credit uni');

    expect(r.payeeNames).toHaveLength(2);
    expect(r.payeeId).toBeNull();
    expect(r.transactionCount).toBe(3);
  });

  it('skips payees with fewer than 3 transactions', () => {
    expect(scoreCandidates(loan.slice(0, 2))).toEqual([]);
  });

  it('flags payees already covered by an enabled rule', () => {
    const covered = scoreCandidates(loan, [
      {
        enabled: true,
        payeeId: null,
        payeeMatchType: 'starts_with',
        payeePattern: 'student',
      },
    ]);
    const disabled = scoreCandidates(loan, [
      {
        enabled: false,
        payeeId: 'Student Loan',
        payeeMatchType: null,
        payeePattern: null,
      },
    ]);

    expect(covered[0].coveredByRule).toBe(true);
    expect(disabled[0].coveredByRule).toBe(false);
  });
});
