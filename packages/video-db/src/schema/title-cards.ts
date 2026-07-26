import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Records a timestamp where a title card was found in a video file. Keyed
 * on fileHash (not filePath) so a lookup survives the file being renamed —
 * source filenames in this library routinely don't match episode titles,
 * and the whole point of this table is to record where the real title is.
 */
export const titleCards = pgTable(
  'title_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileHash: text('file_hash').notNull(),
    /** Last known path the hash was computed from, relative to MEDIA_ROOT. Display/debugging only — not the identity key. */
    filePath: text('file_path').notNull(),
    timestampSeconds: integer('timestamp_seconds').notNull(),
    /** Title text read off the card, if known. */
    title: text('title'),
    /** Path (relative to MEDIA_ROOT) of the screenshot that showed this title card, if any. */
    screenshotPath: text('screenshot_path'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.fileHash, table.timestampSeconds)],
);

export type TitleCard = typeof titleCards.$inferSelect;
export type NewTitleCard = typeof titleCards.$inferInsert;

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the titleCards table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: video-api's generated OpenAPI docs) without hand-editing.
 */
export const titleCardSelectSchema = createSelectSchema(titleCards, {
  createdAt: dateTime,
});
