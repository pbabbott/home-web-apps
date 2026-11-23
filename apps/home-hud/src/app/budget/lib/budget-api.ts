const BUDGET_API_URL = process.env.BUDGET_API_URL ?? 'http://localhost:4005';

export type BudgetJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BudgetJob {
  id: string;
  operation: string;
  status: BudgetJobStatus;
  parameters: Record<string, unknown>;
  workerId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  heartbeatAt: string | null;
  error: string | null;
  message: string | null;
}

export interface YnabSyncState {
  planId: string;
  endpoint: string;
  serverKnowledge: number;
  lastSyncedAt: string;
}

/** Metadata about a stored raw response. The payload itself is never exposed. */
export interface YnabRawResponseSummary {
  id: string;
  jobId: string | null;
  planId: string | null;
  endpoint: string;
  serverKnowledgeRequested: number | null;
  serverKnowledgeReturned: number | null;
  httpStatus: number;
  payloadBytes: number;
  payloadSha256: string;
  fetchedAt: string;
}

export interface YnabPlan {
  id: string;
  name: string;
}

/** One sync job's worth of stored responses. */
export interface YnabSyncRun {
  jobId: string | null;
  startedAt: string;
  responses: number;
  /** Full downloads (no cursor sent). */
  snapshots: number;
  /** Incremental requests (a cursor was sent). */
  deltas: number;
  totalBytes: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BUDGET_API_URL}${path}`, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`budget-api GET ${path} returned ${res.status}: ${body}`);
  }

  return res.json();
}

export async function getJobs(): Promise<BudgetJob[]> {
  const data = await get<{ jobs: BudgetJob[] }>('/jobs');
  return data.jobs;
}

export async function getSyncState(): Promise<YnabSyncState[]> {
  const data = await get<{ syncState: YnabSyncState[] }>('/ynab/sync-state');
  return data.syncState;
}

export async function getRawResponses(
  limit = 100,
): Promise<YnabRawResponseSummary[]> {
  const data = await get<{ rawResponses: YnabRawResponseSummary[] }>(
    `/ynab/raw-responses?limit=${limit}`,
  );
  return data.rawResponses;
}

export async function getPlans(): Promise<YnabPlan[]> {
  const data = await get<{ plans: YnabPlan[] }>('/ynab/plans');
  return data.plans;
}

export async function getSyncRuns(): Promise<YnabSyncRun[]> {
  const data = await get<{ syncRuns: YnabSyncRun[] }>('/ynab/sync-runs');
  return data.syncRuns;
}

export type PayeeMatchType =
  | 'equals'
  | 'starts_with'
  | 'contains'
  | 'ends_with';

export interface FilterSelection {
  id: string;
  name: string;
  enabled: boolean;
  planId: string;
  accountId: string | null;
  payeeId: string | null;
  payeeMatchType: PayeeMatchType | null;
  payeePattern: string | null;
  amountMinMilliunits: number | null;
  amountMaxMilliunits: number | null;
  categoryId: string | null;
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A rule as listed: with how many audit entries point at it. */
export interface FilterSelectionListItem extends FilterSelection {
  auditEntryCount: number;
  auditAppliedCount: number;
}

/** Body for creating/replacing a rule; amounts are signed milliunits. */
export interface FilterSelectionInput {
  name: string;
  enabled: boolean;
  planId: string;
  accountId: string | null;
  payeeId: string | null;
  payeeMatchType: PayeeMatchType | null;
  payeePattern: string | null;
  amountMinMilliunits: number | null;
  amountMaxMilliunits: number | null;
  categoryId: string | null;
  autoApprove: boolean;
}

export interface FilterMatchRow {
  id: string;
  date: string;
  amountUnits: string;
  memo: string | null;
  approved: boolean;
  accountName: string | null;
  payeeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroupName: string | null;
  isTransfer: boolean;
  isSplit: boolean;
}

export interface FilterPreview {
  matched: number;
  actionable: number;
  rows: FilterMatchRow[];
  truncated: boolean;
}

export interface FilterAuditEntry {
  id: string;
  appliedAt: string;
  jobId: string | null;
  filterSelectionId: string | null;
  ruleName: string;
  ruleDescription: string;
  planId: string;
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  accountName: string | null;
  payeeName: string | null;
  action: 'categorize' | 'approve';
  fromValue: string | null;
  toValue: string | null;
  status: 'applied' | 'skipped_conflict' | 'failed';
  error: string | null;
}

export interface YnabReference {
  accounts: { id: string; name: string; closed: boolean }[];
  payees: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    groupName: string;
    hidden: boolean;
  }[];
}

export async function getFilterSelections(): Promise<
  FilterSelectionListItem[]
> {
  const data = await get<{ filterSelections: FilterSelectionListItem[] }>(
    '/filter-selections',
  );
  return data.filterSelections;
}

export async function getFilterSelection(id: string): Promise<FilterSelection> {
  return get<FilterSelection>(`/filter-selections/${id}`);
}

export async function getFilterAudit(limit = 200): Promise<FilterAuditEntry[]> {
  const data = await get<{ entries: FilterAuditEntry[] }>(
    `/filter-selections/audit?limit=${limit}`,
  );
  return data.entries;
}

export async function getYnabReference(planId: string): Promise<YnabReference> {
  return get<YnabReference>(
    `/ynab/reference?planId=${encodeURIComponent(planId)}`,
  );
}
