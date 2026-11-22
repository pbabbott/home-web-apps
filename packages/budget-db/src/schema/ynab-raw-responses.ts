import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/** YNAB API resources that are ingested into the raw layer. */
export const YNAB_ENDPOINTS = [
  'plans',
  'accounts',
  'categories',
  'months',
  'payees',
  'scheduled_transactions',
  'transactions',
] as const;

export type YnabEndpoint = (typeof YNAB_ENDPOINTS)[number];

/**
 * Raw landing layer for the YNAB API: one append-only row per HTTP response,
 * stored verbatim so later transformations can be replayed without calling
 * YNAB again (200 requests/hour limit). Rows are never updated. A delta
 * response holds only the entities that changed since
 * `server_knowledge_requested`; a row with a null requested value is a full
 * snapshot. Replaying a (plan_id, endpoint) means folding its rows in
 * fetched_at order.
 */
export const ynabRawResponses = pgTable(
  'ynab_raw_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** budget_jobs.id of the sync job that fetched this; no FK so job cleanup never touches raw data. */
    jobId: uuid('job_id'),
    /** Null for account-wide endpoints (`plans`). */
    planId: text('plan_id'),
    endpoint: text('endpoint').$type<YnabEndpoint>().notNull(),
    requestParams: jsonb('request_params').notNull().default({}),
    serverKnowledgeRequested: bigint('server_knowledge_requested', {
      mode: 'number',
    }),
    serverKnowledgeReturned: bigint('server_knowledge_returned', {
      mode: 'number',
    }),
    httpStatus: integer('http_status').notNull(),
    payload: jsonb('payload').notNull(),
    payloadSha256: text('payload_sha256').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ynab_raw_responses_plan_endpoint_fetched_idx').on(
      table.planId,
      table.endpoint,
      table.fetchedAt,
    ),
  ],
);

export type YnabRawResponse = typeof ynabRawResponses.$inferSelect;
export type NewYnabRawResponse = typeof ynabRawResponses.$inferInsert;

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const ynabRawResponseSelectSchema = createSelectSchema(
  ynabRawResponses,
  {
    requestParams: () => z.record(z.string(), z.unknown()),
    payload: () => z.unknown(),
    fetchedAt: dateTime,
  },
);
