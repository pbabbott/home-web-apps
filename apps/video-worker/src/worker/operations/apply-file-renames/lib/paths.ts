import path from 'path';
import { config } from '../../../../config';
import { resolveWithinRoot } from '../../../../lib/safe-path';
import { JobProcessingError } from '../../../job-processing-error';

export const DISCARDED_DIRECTORY_NAME = 'discarded';

/**
 * Canonicalizes a MEDIA_ROOT-relative path so it can be used as a Map key
 * and compared for equality — both the pending-rows map (keyed on
 * originalFilePath) and every lookup against it (another row's
 * suggestedFilePath) must pass through this, or a real path collision could
 * go undetected over something as trivial as a doubled slash.
 */
export const normalizeRelPath = (relPath: string): string =>
  path.normalize(relPath);

/**
 * Resolves a MEDIA_ROOT-relative path to an absolute one, guarding against
 * traversal outside MEDIA_ROOT the same way every other filesystem-touching
 * step in this codebase does. Every path this operation touches — source,
 * suggested target(s), discarded destination — goes through this before any
 * fs/ffmpeg call.
 */
export const resolveMediaPath = (relPath: string): string => {
  const absPath = resolveWithinRoot(config.mediaRoot, relPath);

  if (!absPath) {
    throw new JobProcessingError(`path escapes MEDIA_ROOT: ${relPath}`);
  }

  return absPath;
};

/**
 * `discarded/<original relative path>` — where a split's now-superseded
 * original file is moved once both of its outputs are confirmed written.
 * Mirrors the original's directory structure so it stays identifiable.
 */
export const discardedRelPath = (originalRelPath: string): string =>
  `${DISCARDED_DIRECTORY_NAME}/${normalizeRelPath(originalRelPath)}`;
