import {
  describeSkips,
  guessKind,
  isStaleClaim,
  jobPhase,
  jobDetailUrl,
  parsePathLines,
  parseQueueStatus,
} from '../../src/app/exodus/lib/job-display';

describe('parseQueueStatus', () => {
  it.each(['queued', 'in_progress', 'completed', 'failed', 'skipped'])(
    'accepts %s',
    (value) => {
      expect(parseQueueStatus(value)).toBe(value);
    },
  );

  it.each([undefined, '', 'done', 'FAILED'])('ignores %p', (value) => {
    expect(parseQueueStatus(value)).toBeUndefined();
  });
});

describe('jobDetailUrl', () => {
  it('links to the job, with an optional status filter', () => {
    expect(jobDetailUrl('abc')).toBe('/exodus/jobs/abc');
    expect(jobDetailUrl('abc', 'failed')).toBe(
      '/exodus/jobs/abc?status=failed',
    );
  });
});

describe('describeSkips', () => {
  it('is empty when nothing was skipped or there is no result', () => {
    expect(describeSkips(null)).toBe('');
    expect(describeSkips({ skipped: [] })).toBe('');
    expect(describeSkips({ skipped: [], skippedGroups: [] })).toBe('');
  });

  it('counts paths and patterns', () => {
    expect(
      describeSkips({
        skipped: [
          { path: 'C:\\a', reason: 'x' },
          { path: 'C:\\b', reason: 'x' },
        ],
        skippedGroups: [{ pattern: '*.msi', reason: 'installers' }],
      }),
    ).toBe('2 skipped, 1 pattern');
    expect(
      describeSkips({
        skipped: [],
        skippedGroups: [
          { pattern: '*.msi', reason: 'x' },
          { pattern: '*.iso', reason: 'x' },
        ],
      }),
    ).toBe('2 patterns');
  });
});

describe('parsePathLines', () => {
  it('trims lines and drops blanks', () => {
    expect(parsePathLines('  C:\\a \n\n C:\\b\r\n   \n')).toEqual([
      'C:\\a',
      'C:\\b',
    ]);
  });
});

describe('guessKind', () => {
  it('calls a name with an extension a file', () => {
    expect(guessKind('C:\\Users\\Me\\Downloads\\tax-return.pdf')).toBe('file');
    expect(guessKind('C:\\a\\archive.tar.gz')).toBe('file');
  });

  it('calls anything else a directory', () => {
    expect(guessKind('C:\\Users\\Me\\Downloads\\Taxes')).toBe('directory');
    expect(guessKind('C:\\Users\\Me\\Downloads\\')).toBe('directory');
    expect(guessKind('C:\\code\\.git')).toBe('directory');
    expect(guessKind('C:\\a\\v1.')).toBe('directory');
  });
});

describe('jobPhase', () => {
  const counts = (over: Partial<Record<string, number>> = {}) => ({
    queued: 0,
    in_progress: 0,
    completed: 5,
    failed: 0,
    skipped: 0,
    ...over,
  });

  it('is work_remaining while anything is queued or in progress', () => {
    expect(jobPhase(counts({ queued: 2 }), 0).phase).toBe('work_remaining');
    expect(jobPhase(counts({ in_progress: 1 }), 0).phase).toBe(
      'work_remaining',
    );
  });

  it('reports stuck claims ahead of remaining work', () => {
    const info = jobPhase(counts({ queued: 2, in_progress: 1 }), 1);
    expect(info.phase).toBe('stuck_claims');
    expect(info.detail).toContain('1 directory');
  });

  it('is awaiting_completion when drained, and says when some failed', () => {
    expect(jobPhase(counts(), 0)).toMatchObject({
      phase: 'awaiting_completion',
      color: 'success',
    });
    const failed = jobPhase(counts({ failed: 2 }), 0);
    expect(failed.color).toBe('warning');
    expect(failed.detail).toContain('2 directories failed');
  });
});

describe('isStaleClaim', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');

  it('is true only for an in-progress item past its lease', () => {
    const past = '2026-10-24T11:59:00Z';
    const future = '2026-10-24T12:05:00Z';
    expect(
      isStaleClaim({ status: 'in_progress', leaseExpiresAt: past }, now),
    ).toBe(true);
    expect(
      isStaleClaim({ status: 'in_progress', leaseExpiresAt: future }, now),
    ).toBe(false);
    expect(isStaleClaim({ status: 'queued', leaseExpiresAt: past }, now)).toBe(
      false,
    );
    expect(
      isStaleClaim({ status: 'in_progress', leaseExpiresAt: null }, now),
    ).toBe(false);
  });
});
