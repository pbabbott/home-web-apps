import { eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  titleCards,
  type NewTitleCard,
  type TitleCard,
} from '../schema/title-cards';

export type UpsertTitleCardInput = Pick<
  NewTitleCard,
  'fileHash' | 'filePath' | 'timestampSeconds' | 'title' | 'screenshotPath'
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
        title: input.title,
        screenshotPath: input.screenshotPath,
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

export type ListTitleCardsOptions = {
  fileHash?: string;
};

const LIST_TITLE_CARDS_LIMIT = 100;

export const listTitleCards = async (
  db: Database,
  options: ListTitleCardsOptions = {},
): Promise<TitleCard[]> => {
  return db
    .select()
    .from(titleCards)
    .where(
      options.fileHash ? eq(titleCards.fileHash, options.fileHash) : undefined,
    )
    .orderBy(titleCards.timestampSeconds)
    .limit(LIST_TITLE_CARDS_LIMIT);
};
