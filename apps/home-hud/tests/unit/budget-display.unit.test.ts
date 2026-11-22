import type {
  BudgetJob,
  YnabRawResponseSummary,
} from '../../src/app/budget/lib/budget-api';
import {
  describeRun,
  formatBytes,
  groupCursorsByPlan,
  planLabel,
  isFullSnapshot,
  mostRecentBy,
  recentJobStats,
  responseKind,
  shortId,
  totalBytes,
} from '../../src/app/budget/lib/budget-display';

const job = (status: BudgetJob['status'], createdAt: string): BudgetJob => ({
  id: createdAt,
  operation: 'ynab_sync',
  status,
  parameters: {},
  workerId: null,
  createdAt,
  startedAt: null,
  completedAt: null,
  heartbeatAt: null,
  error: null,
  message: null,
});

const row = (
  endpoint: string,
  serverKnowledgeRequested: number | null,
  payloadBytes = 100,
): YnabRawResponseSummary => ({
  id: 'r',
  jobId: null,
  planId: 'plan',
  endpoint,
  serverKnowledgeRequested,
  serverKnowledgeReturned: 5,
  httpStatus: 200,
  payloadBytes,
  payloadSha256: 'x',
  fetchedAt: '2026-01-01T00:00:00Z',
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});

describe('shortId', () => {
  it('truncates and handles null', () => {
    expect(shortId('123e4567-e89b')).toBe('123e4567');
    expect(shortId(null)).toBe('—');
  });
});

describe('responseKind', () => {
  it('distinguishes snapshots, deltas and the plans list', () => {
    expect(responseKind(row('transactions', null))).toBe('snapshot');
    expect(responseKind(row('transactions', 10))).toBe('delta');
    expect(responseKind(row('plans', null))).toBe('list');
    expect(isFullSnapshot(row('plans', null))).toBe(false);
  });
});

describe('totalBytes', () => {
  it('sums payload sizes', () => {
    expect(totalBytes([row('a', null, 10), row('b', 1, 32)])).toBe(42);
    expect(totalBytes([])).toBe(0);
  });
});

describe('recentJobStats', () => {
  it('ignores unfinished jobs when computing the success rate', () => {
    const stats = recentJobStats([
      job('completed', '2026-01-01T00:00:00Z'),
      job('failed', '2026-01-02T00:00:00Z'),
      job('pending', '2026-01-03T00:00:00Z'),
      job('completed', '2026-01-04T00:00:00Z'),
    ]);

    expect(stats).toMatchObject({
      sampleSize: 4,
      successCount: 2,
      failedCount: 1,
    });
    expect(stats.successRate).toBeCloseTo(66.67, 1);
  });

  it('returns a null rate with no finished jobs', () => {
    expect(
      recentJobStats([job('pending', '2026-01-01T00:00:00Z')]),
    ).toMatchObject({ successRate: null });
    expect(recentJobStats(null).sampleSize).toBe(0);
  });
});

describe('mostRecentBy', () => {
  it('picks the newest item', () => {
    const newest = job('completed', '2026-02-01T00:00:00Z');

    expect(mostRecentBy([job('failed', '2026-01-01T00:00:00Z'), newest])).toBe(
      newest,
    );
    expect(mostRecentBy([])).toBeNull();
  });
});

describe('planLabel', () => {
  it('uses the plan name, falling back to a short id', () => {
    const plans = [{ id: '8e6e759d-2422', name: 'Household' }];

    expect(planLabel(plans, '8e6e759d-2422')).toBe('Household');
    expect(planLabel(plans, 'abcdef12-0000')).toBe('abcdef12');
    expect(planLabel(null, 'abcdef12-0000')).toBe('abcdef12');
  });
});

describe('groupCursorsByPlan', () => {
  it('groups cursors into one row per plan', () => {
    const state = (planId: string, endpoint: string) => ({
      planId,
      endpoint,
      serverKnowledge: 1,
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });

    const rows = groupCursorsByPlan([
      state('b', 'accounts'),
      state('a', 'accounts'),
      state('a', 'payees'),
    ]);

    expect(rows.map((r) => r.planId)).toEqual(['a', 'b']);
    expect(Object.keys(rows[0].byEndpoint)).toEqual(['accounts', 'payees']);
    expect(groupCursorsByPlan(null)).toEqual([]);
  });
});

describe('describeRun', () => {
  it('describes snapshots, updates and the plan list', () => {
    expect(describeRun({ snapshots: 6, deltas: 0, responses: 7 })).toBe(
      '6 full downloads + 1 plan list',
    );
    expect(describeRun({ snapshots: 0, deltas: 6, responses: 7 })).toBe(
      '6 updates + 1 plan list',
    );
    expect(describeRun({ snapshots: 1, deltas: 1, responses: 2 })).toBe(
      '1 full download + 1 update',
    );
    expect(describeRun({ snapshots: 0, deltas: 0, responses: 0 })).toBe(
      'nothing stored',
    );
  });
});
