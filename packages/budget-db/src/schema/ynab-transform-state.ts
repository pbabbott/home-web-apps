import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { YnabEndpoint } from './ynab-raw-responses';

/**
 * Watermark of the raw -> typed fold per (plan, endpoint): the last raw
 * response already applied. Raw rows are never updated, so progress lives
 * here; it is advanced in the same transaction that applies the response.
 */
export const ynabTransformState = pgTable(
  'ynab_transform_state',
  {
    planId: text('plan_id').notNull(),
    endpoint: text('endpoint').$type<YnabEndpoint>().notNull(),
    lastRawResponseId: uuid('last_raw_response_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.endpoint] })],
);

export type YnabTransformState = typeof ynabTransformState.$inferSelect;
