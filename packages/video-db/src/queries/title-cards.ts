import { and, eq, like } from 'drizzle-orm';
import type { Database } from '../client';
import {
  titleCards,
  type NewTitleCard,
  type TitleCard,
} from '../schema/title-cards';

export type UpsertTitleCardInput = Pick<
  NewTitleCard,
  | 'fileHash'
  | 'filePath'
  | 'timestampSeconds'
  | 'runTimeSeconds'
  | 'title'
  | 'screenshotPath'
  | 'screenshotBase64'
>;

/**
 * Inserts a title-card record, or updates the existing one for the same
 * (fileHash, timestampSeconds) pair. Upsert (rather than insert-or-409)
 * because re-scanning an already-recorded timestamp is an expected,
 * harmless occurrence, not an error the caller needs to handle.
 */
export const upsertTitleCard = async (
  db: Database,
  input: UpsertTitleCardInput,
): Promise<TitleCard> => {
  const [titleCard] = await db
    .insert(titleCards)
    .values(input)
    .onConflictDoUpdate({
      target: [titleCards.fileHash, titleCards.timestampSeconds],
      set: {
        filePath: input.filePath,
        runTimeSeconds: input.runTimeSeconds,
        title: input.title,
        screenshotPath: input.screenshotPath,
        screenshotBase64: input.screenshotBase64,
      },
    })
    .returning();

  return titleCard;
};

export const getTitleCardById = async (
  db: Database,
  id: string,
): Promise<TitleCard | undefined> => {
  const [titleCard] = await db
    .select()
    .from(titleCards)
    .where(eq(titleCards.id, id));

  return titleCard;
};

/**
 * Deletes a single title-card row by id, returning it (or undefined if no
 * row matched). Row-level rather than season/file-scoped so a bad
 * detection can be removed on its own without disturbing correctly
 * detected siblings — the episode becomes eligible for reprocessing again
 * (checkTitleCardRecords only skips episodes that still have a row).
 */
export const deleteTitleCardById = async (
  db: Database,
  id: string,
): Promise<TitleCard | undefined> => {
  const [titleCard] = await db
    .delete(titleCards)
    .where(eq(titleCards.id, id))
    .returning();

  return titleCard;
};

export type ListTitleCardsOptions = {
  fileHash?: string;
  season?: number;
};

const LIST_TITLE_CARDS_LIMIT = 100;

/** Matches a file_path with `Season <N>` as its own path segment — same convention as seasonDirectoryRelPath in video-worker, e.g. "media/tv_shows/Paw Patrol/Season 4/...". The trailing slash keeps "Season 4" from also matching "Season 40". */
const seasonPathPattern = (season: number): string => `%/Season ${season}/%`;

export const listTitleCards = async (
  db: Database,
  options: ListTitleCardsOptions = {},
): Promise<TitleCard[]> => {
  const conditions = [];

  if (options.fileHash) {
    conditions.push(eq(titleCards.fileHash, options.fileHash));
  }

  if (options.season !== undefined) {
    conditions.push(
      like(titleCards.filePath, seasonPathPattern(options.season)),
    );
  }

  return db
    .select()
    .from(titleCards)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(titleCards.timestampSeconds)
    .limit(LIST_TITLE_CARDS_LIMIT);
};
