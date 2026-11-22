import type {
  BudgetJob,
  BudgetJobStatus,
  YnabPlan,
  YnabRawResponseSummary,
  YnabSyncRun,
  YnabSyncState,
} from './budget-api';

export const operationLabels: Record<string, string> = {
  hello: 'Hello',
  ynab_sync: 'YNAB Sync',
  ynab_transform: 'YNAB Transform',
};

export const jobStatusColor: Record<
  BudgetJobStatus,
  'warning' | 'secondary' | 'success' | 'error'
> = {
  pending: 'warning',
  processing: 'secondary',
  completed: 'success',
  failed: 'error',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** First 8 chars of an id — enough to tell plans/jobs apart in a table. */
export function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}

/** A row with no requested cursor is a full snapshot; otherwise a delta. */
export function isFullSnapshot(
  row: Pick<YnabRawResponseSummary, 'endpoint' | 'serverKnowledgeRequested'>,
): boolean {
  return row.endpoint !== 'plans' && row.serverKnowledgeRequested === null;
}

export function responseKind(
  row: Pick<YnabRawResponseSummary, 'endpoint' | 'serverKnowledgeRequested'>,
): 'snapshot' | 'delta' | 'list' {
  if (row.endpoint === 'plans') return 'list';
  return isFullSnapshot(row) ? 'snapshot' : 'delta';
}

export function totalBytes(rows: YnabRawResponseSummary[]): number {
  return rows.reduce((sum, row) => sum + row.payloadBytes, 0);
}

export function mostRecentBy<T extends { createdAt: string }>(
  items: T[] | null,
): T | null {
  if (!items || items.length === 0) return null;
  return items.reduce((latest, item) =>
    new Date(item.createdAt) > new Date(latest.createdAt) ? item : latest,
  );
}

export interface JobStats {
  sampleSize: number;
  successCount: number;
  failedCount: number;
  /** Percentage of finished (completed + failed) jobs that succeeded, or null when none finished. */
  successRate: number | null;
}

export function recentJobStats(
  jobs: BudgetJob[] | null,
  sampleSize = 20,
): JobStats {
  const recent = [...(jobs ?? [])]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, sampleSize);

  const successCount = recent.filter((j) => j.status === 'completed').length;
  const failedCount = recent.filter((j) => j.status === 'failed').length;
  const finished = successCount + failedCount;

  return {
    sampleSize: recent.length,
    successCount,
    failedCount,
    successRate: finished > 0 ? (successCount / finished) * 100 : null,
  };
}

// Fixed locale so server and client render identical text. The server (and
// the first client render) use UTC; <LocalDate> switches to the browser's
// timezone after mount.
const utcFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const localFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(iso: string, local = false): string {
  return (local ? localFormatter : utcFormatter).format(new Date(iso));
}

/** Plan-scoped endpoints in the order they are shown. */
export const PLAN_ENDPOINT_ORDER = [
  'accounts',
  'categories',
  'months',
  'payees',
  'scheduled_transactions',
  'transactions',
] as const;

/** Plan name when known, otherwise a shortened id. */
export function planLabel(plans: YnabPlan[] | null, planId: string): string {
  return plans?.find((p) => p.id === planId)?.name ?? shortId(planId);
}

export interface PlanCursorRow {
  planId: string;
  /** endpoint -> its cursor, for the endpoints this plan has been synced for. */
  byEndpoint: Record<string, YnabSyncState>;
}

/** Groups the flat cursor list into one row per plan, sorted by plan id. */
export function groupCursorsByPlan(
  syncState: YnabSyncState[] | null,
): PlanCursorRow[] {
  const rows = new Map<string, PlanCursorRow>();

  for (const state of syncState ?? []) {
    const row = rows.get(state.planId) ?? {
      planId: state.planId,
      byEndpoint: {},
    };
    row.byEndpoint[state.endpoint] = state;
    rows.set(state.planId, row);
  }

  return [...rows.values()].sort((a, b) => a.planId.localeCompare(b.planId));
}

/** One-line description of a sync run, e.g. "6 full downloads" or "6 updates". */
export function describeRun(
  run: Pick<YnabSyncRun, 'snapshots' | 'deltas' | 'responses'>,
): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  if (run.snapshots > 0) {
    parts.push(plural(run.snapshots, 'full download', 'full downloads'));
  }
  if (run.deltas > 0) parts.push(plural(run.deltas, 'update', 'updates'));

  const other = run.responses - run.snapshots - run.deltas;
  if (other > 0) parts.push(plural(other, 'plan list', 'plan lists'));

  return parts.join(' + ') || 'nothing stored';
}

export interface SyncJobRow {
  job: BudgetJob;
  /** What the job stored; null while pending/processing or if it failed before storing. */
  run: YnabSyncRun | null;
}

/**
 * One row per `ynab_sync` job, newest first, joined to its stored-response
 * summary by job id. Runs are derived from raw responses, so jobs that never
 * stored anything have `run: null`.
 */
export function joinSyncJobs(
  jobs: BudgetJob[] | null,
  runs: YnabSyncRun[] | null,
): SyncJobRow[] {
  const runByJob = new Map(
    (runs ?? []).flatMap((run) =>
      run.jobId ? [[run.jobId, run] as const] : [],
    ),
  );

  return (jobs ?? [])
    .filter((job) => job.operation === 'ynab_sync')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((job) => ({ job, run: runByJob.get(job.id) ?? null }));
}
