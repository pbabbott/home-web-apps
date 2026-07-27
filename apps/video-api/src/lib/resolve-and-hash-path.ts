import { hashFile } from '@abbottland/video-db';
import { resolveFilePath } from './resolve-file-path';

export type ResolveAndHashResult =
  | { ok: true; hash: string }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Resolves `filePath` within MEDIA_ROOT and hashes it. Pure — callers
 * translate the failure case into an HTTP response themselves, so this
 * stays reusable across controllers (title-cards, file-renames) without
 * any Express coupling.
 */
export const resolveAndHashPath = async (
  filePath: string,
): Promise<ResolveAndHashResult> => {
  const resolved = resolveFilePath(filePath);

  if (resolved.ok === false) {
    return resolved;
  }

  const hash = await hashFile(resolved.absPath);
  return { ok: true, hash };
};
