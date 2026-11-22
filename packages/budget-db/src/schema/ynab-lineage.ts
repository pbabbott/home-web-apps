import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Columns shared by every typed YNAB table: soft-delete flag (YNAB marks
 * removed entities `deleted` in deltas) and lineage back to the raw response
 * that last wrote the row, so any value can be traced to its source.
 */
export const ynabLineageColumns = {
  deleted: boolean('deleted').notNull().default(false),
  lastRawResponseId: uuid('last_raw_response_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};
