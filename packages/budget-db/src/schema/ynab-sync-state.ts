import {
  bigint,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import type { YnabEndpoint } from './ynab-raw-responses';

/**
 * Delta cursor per (plan, endpoint): the `server_knowledge` to send as
 * `last_knowledge_of_server` on the next fetch. Advanced in the same
 * transaction that stores the raw response it came from.
 */
export const ynabSyncState = pgTable(
  'ynab_sync_state',
  {
    planId: text('plan_id').notNull(),
    endpoint: text('endpoint').$type<YnabEndpoint>().notNull(),
    serverKnowledge: bigint('server_knowledge', { mode: 'number' }).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.endpoint] })],
);

export type YnabSyncState = typeof ynabSyncState.$inferSelect;

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

export const ynabSyncStateSelectSchema = createSelectSchema(ynabSyncState, {
  lastSyncedAt: dateTime,
});
