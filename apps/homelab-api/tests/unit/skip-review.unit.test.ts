import type { QueueItemResult } from '@abbottland/homelab-db';
import {
  directoryReviewed,
  reviewSkips,
} from '../../src/services/discovery/skip-review';

const result: QueueItemResult = {
  skipped: [
    { path: 'C:\\Users\\You\\Docs\\Cache', reason: 'cache' },
    { path: 'C:\\Users\\You\\Docs\\Tmp', reason: 'temp' },
  ],
  skippedGroups: [{ pattern: '*.tmp', count: 3, reason: 'temp files' }],
};
const directory = 'C:\\Users\\You\\Docs';
const none = {
  acknowledged: new Set<string>(),
  inventoried: new Set<string>(),
};

describe('reviewSkips', () => {
  it('says nothing before the directory has a result', () => {
    expect(reviewSkips(directory, null, none).reviewed).toBeNull();
  });

  it('is reviewed when there are no skips', () => {
    expect(reviewSkips(directory, { skipped: [] }, none).reviewed).toBe(true);
  });

  it('is not reviewed while a skip is untouched', () => {
    const review = reviewSkips(directory, result, none);

    expect(review.reviewed).toBe(false);
    expect(review.paths).toHaveLength(2);
    expect(review.patterns).toEqual([
      { pattern: '*.tmp', acknowledged: false },
    ]);
  });

  it('is reviewed once paths are acknowledged or inventoried and patterns acknowledged', () => {
    const review = reviewSkips(directory, result, {
      acknowledged: new Set([
        'c:\\users\\you\\docs\\cache|',
        'c:\\users\\you\\docs|*.tmp',
      ]),
      inventoried: new Set(['c:\\users\\you\\docs\\tmp']),
    });

    expect(review.reviewed).toBe(true);
    expect(review.paths).toEqual([
      {
        path: 'C:\\Users\\You\\Docs\\Cache',
        acknowledged: true,
        inventoried: false,
      },
      {
        path: 'C:\\Users\\You\\Docs\\Tmp',
        acknowledged: false,
        inventoried: true,
      },
    ]);
  });

  it('does not count an inventoried path as a reviewed pattern', () => {
    const review = reviewSkips(directory, result, {
      acknowledged: new Set(),
      inventoried: new Set([
        'c:\\users\\you\\docs\\cache',
        'c:\\users\\you\\docs\\tmp',
      ]),
    });

    expect(review.reviewed).toBe(false);
  });
});

describe('directoryReviewed', () => {
  const review = (reviewed: boolean | null) => ({
    reviewed,
    paths: [],
    patterns: [],
  });

  it('is null while the skip review is unknown, even with pending inventory', () => {
    expect(directoryReviewed(review(null), 0)).toBeNull();
    expect(directoryReviewed(review(null), 2)).toBeNull();
  });

  it('needs every skip reviewed and no pending inventory decision', () => {
    expect(directoryReviewed(review(true), 0)).toBe(true);
    expect(directoryReviewed(review(true), 1)).toBe(false);
    expect(directoryReviewed(review(false), 0)).toBe(false);
  });
});
