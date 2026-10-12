import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Maps a show's display name (used for Sonarr lookup, Plex filenames, and AI
 * prompts) to its on-disk directory name under MEDIA_ROOT/media/tv_shows —
 * the two aren't guaranteed to match (e.g. a display name with spaces vs. a
 * snake_case directory). seasonCount drives the season-picker UI and is
 * currently seeded by hand; a future series-creation tool can populate it
 * from Sonarr instead.
 */
export const series = pgTable('series', {
  id: uuid('id').primaryKey().defaultRandom(),
  seriesName: text('series_name').notNull().unique(),
  directoryName: text('directory_name').notNull(),
  seasonCount: integer('season_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Series = typeof series.$inferSelect;
export type NewSeries = typeof series.$inferInsert;

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the series table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: video-api's generated OpenAPI docs) without hand-editing.
 */
export const seriesSelectSchema = createSelectSchema(series, {
  createdAt: dateTime,
});
