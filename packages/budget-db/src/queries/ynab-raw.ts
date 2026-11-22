import { createHash } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
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
