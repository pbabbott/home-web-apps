import { createHash } from 'crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  ynabRawResponses,
  type YnabEndpoint,
  type YnabRawResponse,
} from '../schema/ynab-raw-responses';
import { ynabSyncState, type YnabSyncState } from '../schema/ynab-sync-state';

export type RecordYnabRawResponseInput = {
  jobId?: string | null;
  planId?: string | null;
  endpoint: YnabEndpoint;
  requestParams?: Record<string, unknown>;
  serverKnowledgeRequested?: number | null;
  serverKnowledgeReturned?: number | null;
  httpStatus: number;
  payload: unknown;
};

export const getYnabSyncState = async (
  db: Database,
  planId: string,
  endpoint: YnabEndpoint,
): Promise<YnabSyncState | undefined> => {
  const [state] = await db
    .select()
    .from(ynabSyncState)
    .where(
      and(
        eq(ynabSyncState.planId, planId),
        eq(ynabSyncState.endpoint, endpoint),
      ),
    );

  return state;
};

export const listYnabSyncState = async (
  db: Database,
): Promise<YnabSyncState[]> => {
  return db
    .select()
    .from(ynabSyncState)
    .orderBy(asc(ynabSyncState.planId), asc(ynabSyncState.endpoint));
};

/**
 * Appends the raw response and, when it carries a server_knowledge for a
 * plan-scoped endpoint, advances that endpoint's delta cursor — in one
 * transaction, so a crash can neither lose a delta nor skip one.
 */
export const recordYnabRawResponse = async (
  db: Database,
  input: RecordYnabRawResponseInput,
): Promise<YnabRawResponse> => {
  const payloadSha256 = createHash('sha256')
    .update(JSON.stringify(input.payload))
    .digest('hex');

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(ynabRawResponses)
      .values({
        jobId: input.jobId ?? null,
        planId: input.planId ?? null,
        endpoint: input.endpoint,
        requestParams: input.requestParams ?? {},
        serverKnowledgeRequested: input.serverKnowledgeRequested ?? null,
        serverKnowledgeReturned: input.serverKnowledgeReturned ?? null,
        httpStatus: input.httpStatus,
        payload: input.payload,
        payloadSha256,
      })
      .returning();

    if (input.planId && input.serverKnowledgeReturned != null) {
      await tx
        .insert(ynabSyncState)
        .values({
          planId: input.planId,
          endpoint: input.endpoint,
          serverKnowledge: input.serverKnowledgeReturned,
        })
        .onConflictDoUpdate({
          target: [ynabSyncState.planId, ynabSyncState.endpoint],
          set: {
            serverKnowledge: input.serverKnowledgeReturned,
            lastSyncedAt: new Date(),
          },
        });
    }

    return row;
  });
};

export type ListYnabRawResponsesOptions = {
  planId?: string;
  endpoint?: YnabEndpoint;
};

/** Oldest first — the order a replay must fold deltas in. */
export const listYnabRawResponses = async (
  db: Database,
  options: ListYnabRawResponsesOptions = {},
): Promise<YnabRawResponse[]> => {
  const conditions = [
    options.planId ? eq(ynabRawResponses.planId, options.planId) : undefined,
    options.endpoint
      ? eq(ynabRawResponses.endpoint, options.endpoint)
      : undefined,
  ];

  return db
    .select()
    .from(ynabRawResponses)
    .where(and(...conditions))
    .orderBy(asc(ynabRawResponses.fetchedAt));
};

export type YnabRawResponseSummary = Omit<
  YnabRawResponse,
  'payload' | 'requestParams'
> & {
  /** Size of the stored JSON payload, computed in SQL so payloads are never loaded. */
  payloadBytes: number;
};

export type ListYnabRawResponseSummariesOptions =
  ListYnabRawResponsesOptions & {
    limit?: number;
  };

const DEFAULT_SUMMARY_LIMIT = 50;
const MAX_SUMMARY_LIMIT = 200;

/**
 * Newest-first metadata for the raw layer (no payloads), for dashboards.
 * Raw payloads hold personal financial data, so this deliberately selects
 * everything except `payload`.
 */
export const listYnabRawResponseSummaries = async (
  db: Database,
  options: ListYnabRawResponseSummariesOptions = {},
): Promise<YnabRawResponseSummary[]> => {
  const conditions = [
    options.planId ? eq(ynabRawResponses.planId, options.planId) : undefined,
    options.endpoint
      ? eq(ynabRawResponses.endpoint, options.endpoint)
      : undefined,
  ];
  const limit = Math.min(
    options.limit ?? DEFAULT_SUMMARY_LIMIT,
    MAX_SUMMARY_LIMIT,
  );

  const rows = await db
    .select({
      id: ynabRawResponses.id,
      jobId: ynabRawResponses.jobId,
      planId: ynabRawResponses.planId,
      endpoint: ynabRawResponses.endpoint,
      serverKnowledgeRequested: ynabRawResponses.serverKnowledgeRequested,
      serverKnowledgeReturned: ynabRawResponses.serverKnowledgeReturned,
      httpStatus: ynabRawResponses.httpStatus,
      payloadSha256: ynabRawResponses.payloadSha256,
      fetchedAt: ynabRawResponses.fetchedAt,
      payloadBytes: sql<number>`octet_length(${ynabRawResponses.payload}::text)`,
    })
    .from(ynabRawResponses)
    .where(and(...conditions))
    .orderBy(desc(ynabRawResponses.fetchedAt))
    .limit(limit);

  // octet_length returns int4 (a JS number from pg), cast defensively.
  return rows.map((row) => ({
    ...row,
    payloadBytes: Number(row.payloadBytes),
  }));
};

export type YnabPlanSummary = { id: string; name: string };

/**
 * Plan ids and names from the most recent stored `plans` response. Reads
 * only those two fields out of the JSON in SQL, so the rest of the payload
 * (account/financial detail) never leaves the database.
 */
export const listYnabPlans = async (
  db: Database,
): Promise<YnabPlanSummary[]> => {
  const result = await db.execute<YnabPlanSummary>(sql`
    select plan->>'id' as id, plan->>'name' as name
    from (
      select payload
      from ynab_raw_responses
      where endpoint = 'plans'
      order by fetched_at desc
      limit 1
    ) latest,
    jsonb_array_elements(latest.payload->'data'->'plans') as plan
    order by plan->>'name'
  `);

  return result.rows;
};

export type YnabSyncRun = {
  /** The budget_jobs id that fetched these responses (null for rows without one). */
  jobId: string | null;
  startedAt: Date;
  responses: number;
  /** Full downloads of a plan-scoped endpoint (no cursor was sent). */
  snapshots: number;
  /** Delta requests (a cursor was sent). */
  deltas: number;
  totalBytes: number;
};

/** One row per sync job that stored raw responses, newest first. */
export const listYnabSyncRuns = async (
  db: Database,
  limit = 20,
): Promise<YnabSyncRun[]> => {
  const result = await db.execute<{
    job_id: string | null;
    started_at: Date;
    responses: number;
    snapshots: number;
    deltas: number;
    total_bytes: string;
  }>(sql`
    select
      job_id,
      min(fetched_at) as started_at,
      count(*)::int as responses,
      (count(*) filter (
        where plan_id is not null and server_knowledge_requested is null
      ))::int as snapshots,
      (count(*) filter (
        where server_knowledge_requested is not null
      ))::int as deltas,
      coalesce(sum(octet_length(payload::text)), 0)::text as total_bytes
    from ynab_raw_responses
    group by job_id
    order by min(fetched_at) desc
    limit ${Math.min(limit, MAX_SUMMARY_LIMIT)}
  `);

  return result.rows.map((row) => ({
    jobId: row.job_id,
    startedAt: new Date(row.started_at),
    responses: row.responses,
    snapshots: row.snapshots,
    deltas: row.deltas,
    totalBytes: Number(row.total_bytes),
  }));
};
