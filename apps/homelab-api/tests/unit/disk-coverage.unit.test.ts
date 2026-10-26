import type { QueueItemResult } from '@abbottland/homelab-db';
import { classifyEntries } from '../../src/services/discovery/disk-coverage';
import { reviewSkips } from '../../src/services/discovery/skip-review';

const DIR = 'C:\\Users\\You\\Docs';
const entry = (name: string, isDirectory = false) => ({
  name,
  isDirectory,
  size: 1,
  modifiedAt: null,
});

const run = (
  entries: ReturnType<typeof entry>[],
  overrides: Partial<Parameters<typeof classifyEntries>[0]> = {},
  result: QueueItemResult | null = { skipped: [] },
  acknowledged: string[] = [],
) => {
  const skipReview = reviewSkips(DIR, result, {
    acknowledged: new Set(acknowledged),
    inventoried: new Set(),
  });

  return classifyEntries({
    directory: DIR,
    entries,
    inventoryUnder: [],
    coveredByInventoryParent: false,
    queueStatuses: new Map(),
    isExcluded: () => false,
    result,
    skipReview,
    ...overrides,
  });
};

const kinds = (out: ReturnType<typeof run>) =>
  out.entries.map((e) => e.coverage.kind);

describe('classifyEntries', () => {
  it('marks an entry nothing accounts for as uncovered and counts it', () => {
    const out = run([entry('a.txt'), entry('Sub', true)]);

    expect(kinds(out)).toEqual(['uncovered', 'uncovered']);
    expect(out.uncovered).toBe(2);
    expect(out.entries[0].path).toBe('C:\\Users\\You\\Docs\\a.txt');
  });

  it('finds an inventory item at exactly the entry, case-insensitively', () => {
    const out = run([entry('Tax.PDF')], {
      inventoryUnder: [
        {
          normalizedRootPath: 'c:\\users\\you\\docs\\tax.pdf',
          decision: 'pending',
          recommendation: 'back_up',
        },
      ],
    });

    expect(out.entries[0].coverage).toEqual({
      kind: 'inventory',
      decision: 'pending',
      recommendation: 'back_up',
    });
    expect(out.uncovered).toBe(0);
  });

  it('counts inventory deeper down for a directory with none of its own', () => {
    const deeper = (name: string) => ({
      normalizedRootPath: `c:\\users\\you\\docs\\sub\\${name}`,
      decision: 'approved' as const,
      recommendation: 'back_up' as const,
    });
    const out = run([entry('Sub', true)], {
      inventoryUnder: [deeper('a'), deeper('b')],
    });

    expect(out.entries[0].coverage).toEqual({
      kind: 'inventory_inside',
      count: 2,
    });
  });

  it('treats an inventory item at or above the directory as covering everything', () => {
    const out = run([entry('a.txt')], { coveredByInventoryParent: true });

    expect(kinds(out)).toEqual(['inventory_parent']);
  });

  it('recognises skipped paths and patterns, with their acknowledgement', () => {
    const result: QueueItemResult = {
      skipped: [{ path: 'C:\\Users\\You\\Docs\\Cache', reason: 'cache' }],
      skippedGroups: [{ pattern: '*.tmp', reason: 'temp' }],
    };
    const out = run(
      [entry('cache', true), entry('x.TMP'), entry('keep.txt')],
      {},
      result,
      ['c:\\users\\you\\docs\\cache|'],
    );

    expect(out.entries.map((e) => e.coverage)).toEqual([
      { kind: 'skipped', via: 'path', acknowledged: true },
      {
        kind: 'skipped',
        via: 'pattern',
        pattern: '*.tmp',
        acknowledged: false,
      },
      { kind: 'uncovered' },
    ]);
  });

  it('a pattern only matches the entry name, never a deeper path', () => {
    const result: QueueItemResult = {
      skipped: [],
      skippedGroups: [{ pattern: '*.tmp', reason: 'temp' }],
    };

    expect(kinds(run([entry('tmp-folder', true)], {}, result))).toEqual([
      'uncovered',
    ]);
  });

  it('recognises a queue item of its own and an exclusion rule', () => {
    const out = run([entry('Sub', true), entry('Skip', true)], {
      queueStatuses: new Map([['c:\\users\\you\\docs\\sub', 'queued']]),
      isExcluded: (p) => p === 'c:\\users\\you\\docs\\skip',
    });

    expect(out.entries.map((e) => e.coverage)).toEqual([
      { kind: 'queued', status: 'queued' },
      { kind: 'excluded' },
    ]);
  });

  it('puts an inventory item ahead of a skip of the same path', () => {
    const result: QueueItemResult = {
      skipped: [{ path: 'C:\\Users\\You\\Docs\\a.txt', reason: 'x' }],
    };
    const out = run(
      [entry('a.txt')],
      {
        inventoryUnder: [
          {
            normalizedRootPath: 'c:\\users\\you\\docs\\a.txt',
            decision: 'approved',
            recommendation: 'back_up',
          },
        ],
      },
      result,
    );

    expect(kinds(out)).toEqual(['inventory']);
  });

  it('works for a drive root and ignores inventory outside the directory', () => {
    const out = classifyEntries({
      directory: 'C:\\',
      entries: [entry('Users', true)],
      inventoryUnder: [
        {
          normalizedRootPath: 'd:\\users',
          decision: 'approved',
          recommendation: 'back_up',
        },
      ],
      coveredByInventoryParent: false,
      queueStatuses: new Map(),
      isExcluded: () => false,
      result: null,
      skipReview: { reviewed: null, paths: [], patterns: [] },
    });

    expect(out.entries[0].path).toBe('C:\\Users');
    expect(out.entries[0].coverage.kind).toBe('uncovered');
  });
});
