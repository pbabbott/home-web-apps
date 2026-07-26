import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import {
  fileRenames,
  type FileRename,
  type FileRenameStatus,
  type NewFileRename,
} from '../schema/file-renames';

export type UpsertFileRenameInput = Pick<
  NewFileRename,
  'fileHash' | 'originalFilePath' | 'suggestedFilePath'
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
