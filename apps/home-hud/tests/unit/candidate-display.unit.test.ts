import {
  candidatesUrl,
  changedSinceDecision,
  describeGit,
  parseDecisionFilter,
  parseRecommendation,
} from '../../src/app/exodus/lib/candidate-display';

describe('parseDecisionFilter', () => {
  it.each(['pending', 'approved', 'rejected', 'all'])('accepts %s', (value) => {
    expect(parseDecisionFilter(value)).toBe(value);
  });

  it.each([undefined, '', 'maybe', 'APPROVED'])(
    'falls back to the review queue (pending) for %p',
    (value) => {
      expect(parseDecisionFilter(value)).toBe('pending');
    },
  );
});

describe('parseRecommendation', () => {
  it.each(['back_up', 'skip', 'needs_review'])('accepts %s', (value) => {
    expect(parseRecommendation(value)).toBe(value);
  });

  it.each([undefined, '', 'keep', 'SKIP'])('ignores %p', (value) => {
    expect(parseRecommendation(value)).toBeUndefined();
  });
});

describe('changedSinceDecision', () => {
  const decided = '2026-10-19T10:00:00.000Z';

  it('flags a recommendation updated after the decision', () => {
    expect(
      changedSinceDecision({
        decision: 'approved',
        decidedAt: decided,
        recommendedAt: '2026-10-19T11:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('does not flag one that predates the decision', () => {
    expect(
      changedSinceDecision({
        decision: 'rejected',
        decidedAt: decided,
        recommendedAt: '2026-10-19T09:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('never flags a pending candidate', () => {
    expect(
      changedSinceDecision({
        decision: 'pending',
        decidedAt: null,
        recommendedAt: '2026-10-19T11:00:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('describeGit', () => {
  it('shows unknowns as unknown rather than no', () => {
    const lines = describeGit({
      remoteUrl: 'https://github.com/x/y',
      remoteVisibility: 'public',
      localStateKnown: false,
      uncommittedChanges: null,
      untrackedFiles: false,
      unpushedCommits: true,
      ignoredFilesOfNote: null,
    });

    expect(lines).toEqual([
      'Remote: https://github.com/x/y (public)',
      'Local state checked: no',
      'Uncommitted changes: unknown',
      'Untracked files: no',
      'Unpushed commits: yes',
      'Notable ignored files: unknown',
    ]);
  });

  it('says none when there is no remote', () => {
    expect(
      describeGit({
        remoteUrl: null,
        remoteVisibility: 'none',
        localStateKnown: true,
        uncommittedChanges: false,
        untrackedFiles: false,
        unpushedCommits: false,
        ignoredFilesOfNote: false,
      })[0],
    ).toBe('Remote: none (none)');
  });
});

describe('candidatesUrl', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';

  it('is the bare path for the default view', () => {
    expect(candidatesUrl({})).toBe('/exodus/candidates');
    expect(candidatesUrl({ decision: 'pending' })).toBe('/exodus/candidates');
  });

  it('keeps only non-default state', () => {
    const url = candidatesUrl({
      source: id,
      decision: 'all',
      recommendation: 'needs_review',
      after: 'c:\\code\\a',
    });
    const params = new URL(url, 'http://x').searchParams;

    expect(params.get('source')).toBe(id);
    expect(params.get('decision')).toBe('all');
    expect(params.get('recommendation')).toBe('needs_review');
    expect(params.get('after')).toBe('c:\\code\\a');
  });
});
