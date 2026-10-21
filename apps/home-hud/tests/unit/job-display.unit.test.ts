import {
  describeSkippedGroup,
  describeSkips,
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

describe('describeSkippedGroup', () => {
  it('shows the count when the agent counted', () => {
    expect(describeSkippedGroup({ pattern: '*.msi', count: 212 })).toBe(
      '*.msi ×212',
    );
    expect(describeSkippedGroup({ pattern: '*.msi', count: 0 })).toBe(
      '*.msi ×0',
    );
  });

  it('shows just the pattern otherwise', () => {
    expect(describeSkippedGroup({ pattern: '*.iso' })).toBe('*.iso');
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
