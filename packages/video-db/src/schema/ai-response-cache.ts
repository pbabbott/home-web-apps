import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Caches a raw AI API response, keyed on (screenshotPath, model) — calling
 * a vision model is expensive, so a screenshot already asked about with a
 * given model never needs to be asked again. `response` is stored as-is
 * (jsonb); callers know the shape they asked for and cast it back
 * themselves, so this table isn't tied to any one prompt/task.
 */
export const aiResponseCache = pgTable(
  'ai_response_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Path (relative to MEDIA_ROOT) of the screenshot the response is about. */
    screenshotPath: text('screenshot_path').notNull(),
    /** Model name requested from the AI API. */
    model: text('model').notNull(),
    response: jsonb('response').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.screenshotPath, table.model)],
);

export type AiResponseCache = typeof aiResponseCache.$inferSelect;
export type NewAiResponseCache = typeof aiResponseCache.$inferInsert;

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the aiResponseCache table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * without hand-editing.
 */
export const aiResponseCacheSelectSchema = createSelectSchema(aiResponseCache, {
  response: () => z.unknown(),
  createdAt: dateTime,
});
