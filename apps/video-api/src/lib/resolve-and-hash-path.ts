import fs from 'fs';
import { config } from '../config';
import { hashFile } from './file-hash';
import { resolveWithinRoot } from './safe-path';

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
  const absPath = resolveWithinRoot(config.mediaRoot, filePath);

  if (!absPath) {
    return {
      ok: false,
      status: 400,
      message: 'filePath is outside the configured media root',
    };
  }

  if (!fs.existsSync(absPath)) {
    return { ok: false, status: 404, message: 'file not found' };
  }

  const hash = await hashFile(absPath);
  return { ok: true, hash };
};
