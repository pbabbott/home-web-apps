import path from 'path';
import { EntryFailure } from './errors';
import { resolveWithinRoot } from '../lib/safe-path';

/** The longest name NFS (and ext4) accepts, in bytes. */
export const MAX_NAME_BYTES = 255;
export const STAGING_DIR = '.exodus-staging';

/**
 * Splits a path relative to an item root (`\`-separated, `''` for the root
 * itself) into names, refusing anything that could leave the item or is not a
 * plain name. A name over 255 bytes is `name_too_long`.
 */
export const splitRelPath = (relPath: string): string[] => {
  if (relPath === '') return [];

  return relPath.split('\\').map((name) => {
    if (
      name === '' ||
      name === '.' ||
      name === '..' ||
      name.includes('\0') ||
      name.includes('/')
    ) {
      throw new EntryFailure(
        'unsupported_path',
        `"${relPath}" is not a path the destination can hold`,
      );
    }
    if (Buffer.byteLength(name) > MAX_NAME_BYTES) {
      throw new EntryFailure(
        'name_too_long',
        `a name in "${relPath}" is longer than ${MAX_NAME_BYTES} bytes`,
      );
    }

    return name;
  });
};

/**
 * Where an entry goes, relative to `<source_dir_name>/`: the item's own path
 * (`C/Users/Me`, set at planning) plus the entry's path below the item root.
 * A pure function of its inputs, so a retry lands on the same path.
 */
export const entryDestRel = (
  itemDestRelPath: string,
  relPath: string,
): string =>
  [...itemDestRelPath.split('/'), ...splitRelPath(relPath)].join('/');

/** The source path of an entry: the item's Windows root plus the relative path. */
export const entrySourcePath = (rootPath: string, relPath: string): string =>
  relPath === '' ? rootPath : `${rootPath}\\${relPath}`;

/**
 * `photo.jpg` -> `photo.exodus-1a2b3c4d.jpg`: the first 8 characters of the
 * job id, before the last extension (a leading dot is part of the stem).
 */
export const keepBothRel = (rel: string, jobId: string): string => {
  const dir = path.posix.dirname(rel);
  const name = path.posix.basename(rel);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const renamed = `${stem}.exodus-${jobId.slice(0, 8)}${ext}`;

  if (Buffer.byteLength(renamed) > MAX_NAME_BYTES) {
    throw new EntryFailure(
      'name_too_long',
      `"${renamed}" (keep-both name) is longer than ${MAX_NAME_BYTES} bytes`,
    );
  }

  return dir === '.' ? renamed : `${dir}/${renamed}`;
};

/**
 * Absolute destination path of a path relative to `<source_dir_name>/`.
 * `baseRoot` is `<mount>/<root_dir>`. Refuses a path that resolves outside
 * `<baseRoot>/<sourceDirName>`.
 */
export const destAbs = (
  baseRoot: string,
  sourceDirName: string,
  rel: string,
): string => {
  const sourceRoot = resolveWithinRoot(baseRoot, sourceDirName);
  const resolved = sourceRoot && resolveWithinRoot(sourceRoot, rel);

  if (!resolved || sourceDirName === '' || sourceDirName.includes('/')) {
    throw new EntryFailure(
      'unsupported_path',
      `"${rel}" resolves outside the destination folder`,
    );
  }

  return resolved;
};

export const stagingDir = (baseRoot: string, jobItemId: string): string =>
  path.join(baseRoot, STAGING_DIR, jobItemId);

export const stagingFile = (
  baseRoot: string,
  jobItemId: string,
  entryId: number,
): string => path.join(stagingDir(baseRoot, jobItemId), String(entryId));
