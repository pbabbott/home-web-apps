import fs from 'fs';
import path from 'path';
import { discardedRelPath, resolveMediaPath } from './paths';

/**
 * Moves a split's now-superseded original file to
 * `discarded/<original relative path>`, mirroring its directory structure.
 * Only ever called after both of the split's output files are confirmed
 * written — never for a plain rename, which just moves the file to its
 * suggested path directly.
 */
export const moveToDiscarded = (
  originalRelPath: string,
  originalAbsPath: string,
): string => {
  const destRelPath = discardedRelPath(originalRelPath);
  const destAbsPath = resolveMediaPath(destRelPath);

  fs.mkdirSync(path.dirname(destAbsPath), { recursive: true });
  fs.renameSync(originalAbsPath, destAbsPath);

  return destRelPath;
};
