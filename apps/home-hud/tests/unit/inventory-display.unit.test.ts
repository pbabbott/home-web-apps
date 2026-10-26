import {
  changedSinceDecision,
  describeGit,
  hasActiveFilters,
  inventoryItemsUrl,
  inventoryItemUrl,
  pageNumbers,
  parseDecisionFilter,
  parseKind,
  parsePage,
  parseRecommendation,
} from '../../src/app/exodus/lib/inventory-display';

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

  it('never flags a pending inventory item', () => {
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

describe('inventoryItemsUrl', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';

  it('is the bare path for the default view', () => {
    expect(inventoryItemsUrl({})).toBe('/exodus/inventory');
    expect(inventoryItemsUrl({ decision: 'pending' })).toBe(
      '/exodus/inventory',
    );
  });

  it('keeps only non-default state', () => {
    const url = inventoryItemsUrl({
      source: id,
      decision: 'all',
      recommendation: 'needs_review',
      page: 3,
    });
    const params = new URL(url, 'http://x').searchParams;

    expect(params.get('source')).toBe(id);
    expect(params.get('decision')).toBe('all');
    expect(params.get('recommendation')).toBe('needs_review');
    expect(params.get('page')).toBe('3');
  });
});

describe('inventoryItemsUrl search, kind and page', () => {
  it('writes search, kind and page, omitting page 1', () => {
    const params = new URL(
      inventoryItemsUrl({ q: 'tax return', kind: 'file', page: 2 }),
      'http://x',
    ).searchParams;

    expect(params.get('q')).toBe('tax return');
    expect(params.get('kind')).toBe('file');
    expect(params.get('page')).toBe('2');
    expect(inventoryItemsUrl({ page: 1 })).toBe('/exodus/inventory');
  });
});

describe('inventoryItemUrl', () => {
  it('links to one item across all decisions', () => {
    const params = new URL(
      inventoryItemUrl('src-1', 'C:\\Users\\Me\\Pictures'),
      'http://x',
    ).searchParams;

    expect(params.get('source')).toBe('src-1');
    expect(params.get('decision')).toBe('all');
    expect(params.get('path')).toBe('C:\\Users\\Me\\Pictures');
  });
});

describe('parseKind', () => {
  it.each(['file', 'directory'])('accepts %s', (value) => {
    expect(parseKind(value)).toBe(value);
  });

  it.each([undefined, '', 'folder'])('ignores %p', (value) => {
    expect(parseKind(value)).toBeUndefined();
  });
});

describe('parsePage', () => {
  it('accepts positive integers', () => {
    expect(parsePage('4')).toBe(4);
  });

  it.each([undefined, '', '0', '-2', '1.5', 'abc'])(
    'uses page 1 for %p',
    (v) => {
      expect(parsePage(v)).toBe(1);
    },
  );
});

describe('hasActiveFilters', () => {
  it('is false for the default review queue', () => {
    expect(hasActiveFilters({ decision: 'pending' })).toBe(false);
    expect(hasActiveFilters({})).toBe(false);
  });

  it.each([
    { decision: 'all' as const },
    { recommendation: 'skip' as const },
    { kind: 'file' as const },
    { q: 'x' },
    { path: 'C:\\x' },
  ])('is true for %p', (view) => {
    expect(hasActiveFilters(view)).toBe(true);
  });
});

describe('pageNumbers', () => {
  it('lists every page when there are few', () => {
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it('collapses distant pages into gaps', () => {
    expect(pageNumbers(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageNumbers(1, 12)).toEqual([1, 2, 'gap', 12]);
    expect(pageNumbers(12, 12)).toEqual([1, 'gap', 11, 12]);
  });

  it('fills a one-page hole instead of showing a gap', () => {
    expect(pageNumbers(3, 8)).toEqual([1, 2, 3, 4, 'gap', 8]);
  });
});
