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
