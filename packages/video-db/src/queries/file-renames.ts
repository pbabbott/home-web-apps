import { and, asc, desc, eq, like, or } from 'drizzle-orm';
import type { Database } from '../client';
import {
  fileRenames,
  type FileRename,
  type FileRenameStatus,
  type NewFileRename,
} from '../schema/file-renames';

export type UpsertFileRenameInput = Pick<
  NewFileRename,
  | 'fileHash'
  | 'originalFilePath'
  | 'suggestedFilePath'
  | 'secondSuggestedFilePath'
  | 'splitAtSeconds'
  | 'sourceTitleCardTitles'
>;

/**
 * Inserts a rename suggestion, or replaces the existing one for the same
 * fileHash. Upsert (not insert-or-409) because re-suggesting a rename for
 * an already-tracked file is an expected occurrence (the AI reconsidering,
 * or the original path having drifted), not an error the caller needs to
 * handle. A re-suggestion resets status back to pending — a prior
 * applied/rejected decision was about the previous suggestion, not this one.
 */
export const upsertFileRename = async (
  db: Database,
  input: UpsertFileRenameInput,
): Promise<FileRename> => {
  const [fileRename] = await db
    .insert(fileRenames)
    .values(input)
    .onConflictDoUpdate({
      target: fileRenames.fileHash,
      set: {
        originalFilePath: input.originalFilePath,
        suggestedFilePath: input.suggestedFilePath,
        secondSuggestedFilePath: input.secondSuggestedFilePath ?? null,
        splitAtSeconds: input.splitAtSeconds ?? null,
        sourceTitleCardTitles: input.sourceTitleCardTitles,
        status: 'pending',
        appliedAt: null,
      },
    })
    .returning();

  return fileRename;
};

export const getFileRenameById = async (
  db: Database,
  id: string,
): Promise<FileRename | undefined> => {
  const [fileRename] = await db
    .select()
    .from(fileRenames)
    .where(eq(fileRenames.id, id));

  return fileRename;
};

export const updateFileRenameStatus = async (
  db: Database,
  id: string,
  status: FileRenameStatus,
): Promise<FileRename | undefined> => {
  const [fileRename] = await db
    .update(fileRenames)
    .set({ status, appliedAt: status === 'applied' ? new Date() : null })
    .where(eq(fileRenames.id, id))
    .returning();

  return fileRename;
};

export type ListFileRenamesOptions = {
  fileHash?: string;
  status?: FileRenameStatus;
};

const LIST_FILE_RENAMES_LIMIT = 100;

export const listFileRenames = async (
  db: Database,
  options: ListFileRenamesOptions = {},
): Promise<FileRename[]> => {
  const conditions = [
    options.fileHash ? eq(fileRenames.fileHash, options.fileHash) : undefined,
    options.status ? eq(fileRenames.status, options.status) : undefined,
  ].filter((condition) => condition !== undefined);

  return db
    .select()
    .from(fileRenames)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(fileRenames.createdAt))
    .limit(LIST_FILE_RENAMES_LIMIT);
};

/**
 * Every pending rename/split, unbounded and oldest-first. Unlike
 * listFileRenames (capped at LIST_FILE_RENAMES_LIMIT, newest-first — built
 * for the paged UI), the apply job needs to consider every pending row in
 * one pass, and oldest-first gives a stable, predictable processing order
 * across runs (collision-chain resolution can reorder execution within
 * that, but the starting point is deterministic).
 */
export const listPendingFileRenames = async (
  db: Database,
): Promise<FileRename[]> =>
  db
    .select()
    .from(fileRenames)
    .where(eq(fileRenames.status, 'pending'))
    .orderBy(asc(fileRenames.createdAt));

/** Matches a path segment `/Season <N>/` exactly — `%Season 1%` alone would also match `Season 10`, `Season 11`, etc. */
const seasonPathPattern = (seasonNumber: number): string =>
  `%/Season ${seasonNumber}/%`;

/**
 * Deletes every file_renames row for a season, matched by path (there's no
 * season column — season only ever existed as a path segment, same as
 * title_cards). Checks both originalFilePath and suggestedFilePath: a
 * suggestion always has the former, but only the latter reflects the
 * season once a suggested destination has actually moved the file's
 * apparent season (e.g. a mis-suggested cross-season rename). Returns the
 * deleted rows so the caller can report how many were removed.
 */
export const deleteFileRenamesBySeason = async (
  db: Database,
  seasonNumber: number,
): Promise<FileRename[]> => {
  const pattern = seasonPathPattern(seasonNumber);

  return db
    .delete(fileRenames)
    .where(
      or(
        like(fileRenames.originalFilePath, pattern),
        like(fileRenames.suggestedFilePath, pattern),
      ),
    )
    .returning();
};
