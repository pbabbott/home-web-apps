import fs from 'fs';
import { config } from '../config';
import { resolveWithinRoot } from './safe-path';

export type ResolveFilePathResult =
  | { ok: true; absPath: string }
  | { ok: false; status: 400 | 404; message: string };

/**
 * Resolves `filePath` within MEDIA_ROOT and confirms it exists. Shared
 * first step for anything that needs to read the file itself (hashing,
 * probing runtime) — callers translate the failure case into an HTTP
 * response themselves, so this stays reusable across controllers without
 * any Express coupling.
 */
export const resolveFilePath = (filePath: string): ResolveFilePathResult => {
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

  return { ok: true, absPath };
};
