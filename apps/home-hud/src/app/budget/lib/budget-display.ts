import type {
  BudgetJob,
  BudgetJobStatus,
  PayeeMatchType,
  YnabPlan,
  YnabRawResponseSummary,
  YnabSyncRun,
  YnabSyncState,
} from './budget-api';

/** Payee text match types: select label and rule-summary phrase. */
export const PAYEE_MATCH_OPTIONS: { value: PayeeMatchType; label: string }[] = [
  { value: 'starts_with', label: 'Starts with' },
  { value: 'contains', label: 'Contains' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'equals', label: 'Equals' },
];

export const MATCH_TYPE_PHRASES: Record<PayeeMatchType, string> = {
  starts_with: 'starts with',
  contains: 'contains',
  ends_with: 'ends with',
  equals: 'equals',
};

export const operationLabels: Record<string, string> = {
  hello: 'Hello',
  ynab_sync: 'YNAB Sync',
  ynab_transform: 'YNAB Transform',
  apply_filter_selections: 'Apply Filter Rules',
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

/** Jobs shown on the sync page: pulling from YNAB and building the typed tables. */
const SYNC_PAGE_OPERATIONS = [
  'ynab_sync',
  'ynab_transform',
  'apply_filter_selections',
];

/** Short label for the Type column, e.g. "sync (full)" or "transform (rebuild)". */
export function syncJobType(
  job: Pick<BudgetJob, 'operation' | 'parameters'>,
): string {
  if (job.operation === 'apply_filter_selections') {
    return 'apply rules';
  }

  if (job.operation === 'ynab_transform') {
    return job.parameters.rebuild ? 'transform (rebuild)' : 'transform';
  }

  return job.parameters.full ? 'sync (full)' : 'sync (update)';
}

export interface SyncJobRow {
  job: BudgetJob;
  /** What the job stored; null while pending/processing or if it failed before storing. */
  run: YnabSyncRun | null;
}

/**
 * One row per `ynab_sync`/`ynab_transform` job, newest first, joined to its stored-response
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
    .filter((job) => SYNC_PAGE_OPERATIONS.includes(job.operation))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((job) => ({ job, run: runByJob.get(job.id) ?? null }));
}

/** "-2,500.00" typed by the user to milliunits; blank is null, junk is NaN. */
export function unitsToMilliunits(text: string): number | null {
  const cleaned = text.replace(/[,\s$]/g, '');

  if (cleaned === '') return null;

  const value = Number(cleaned);

  return Number.isFinite(value) ? Math.round(value * 1000) : Number.NaN;
}

/** Milliunits to the plain number string used in the amount inputs. */
export function milliunitsToUnits(milliunits: number | null): string {
  return milliunits === null ? '' : String(milliunits / 1000);
}

/** "-12.34" style display for an amount in currency units. */
export function formatUnits(units: string | number): string {
  return Number(units).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
