import {
  doublePrecision,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const fileRenameStatusEnum = pgEnum('file_rename_status', [
  'pending',
  'applied',
  'rejected',
]);

/**
 * Records the AI's best-guess destination filename for a video file once
 * it's read the file's title card, keyed on fileHash (not the current
 * path) for the same rename-survival reason as title_cards: source
 * filenames in this library routinely don't match episode titles, which is
 * the whole reason this table exists. One row per file — a later
 * suggestion for the same fileHash replaces the previous one rather than
 * accumulating a history.
 *
 * status tracks the suggestion's lifecycle: nothing renames the file
 * automatically, so this is how a caller distinguishes "still needs
 * renaming" (pending) from "already handled" (applied/rejected).
 */
export const fileRenames = pgTable('file_renames', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileHash: text('file_hash').notNull().unique(),
  /** Path the hash was computed from at suggestion time, relative to MEDIA_ROOT. */
  originalFilePath: text('original_file_path').notNull(),
  /** AI-suggested destination path, relative to MEDIA_ROOT. For a split suggestion (see splitAtSeconds), this is the first segment's destination. Not guaranteed to exist yet — nothing renames or splits the file automatically. */
  suggestedFilePath: text('suggested_file_path').notNull(),
  /** Second segment's suggested destination path, set only when this file bundles two episodes and needs to be split rather than just renamed — see splitAtSeconds. */
  secondSuggestedFilePath: text('second_suggested_file_path'),
  /** Approximate point, in seconds from the start of the original file, where it should be split into suggestedFilePath and secondSuggestedFilePath — refined to ~0.1s precision by refineSplitPoint. Null for a single-episode (no split needed) suggestion. */
  splitAtSeconds: doublePrecision('split_at_seconds'),
  /** title_cards titles the AI was given as evidence for this suggestion — one per matched episode (one for a single-episode file, two for a bundled double-episode file, in which case index 0 matches suggestedFilePath and index 1 matches secondSuggestedFilePath). Recorded so a suggestion can be audited without re-joining against title_cards, which may have since changed. */
  sourceTitleCardTitles: text('source_title_card_titles').array(),
  status: fileRenameStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
});

export type FileRename = typeof fileRenames.$inferSelect;
export type NewFileRename = typeof fileRenames.$inferInsert;
export type FileRenameStatus = (typeof fileRenameStatusEnum.enumValues)[number];

const dateTime = (schema: z.ZodDate) => schema.meta({ format: 'date-time' });

/**
 * Zod schema derived directly from the fileRenames table, so a column
 * added/renamed/retyped here is reflected everywhere this is consumed
 * (currently: video-api's generated OpenAPI docs) without hand-editing.
 */
export const fileRenameSelectSchema = createSelectSchema(fileRenames, {
  createdAt: dateTime,
  appliedAt: dateTime,
});
