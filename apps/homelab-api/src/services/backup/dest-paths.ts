/**
 * Destination folder of an inventory path, relative to the source folder:
 * `C:\Users\Me` -> `C/Users/Me` (drive letter as a folder, no colon),
 * `\\nas\share\a` -> `UNC/nas/share/a`. A pure function, so a retry or a
 * second job lands on the same paths.
 */
export const toDestRelPath = (rootPath: string): string => {
  if (rootPath.startsWith('\\\\')) {
    return ['UNC', ...rootPath.slice(2).split('\\').filter(Boolean)].join('/');
  }

  const [drive, ...rest] = rootPath.split('\\').filter(Boolean);

  return [drive.replace(/:$/, ''), ...rest].join('/');
};

const MAX_SOURCE_DIR_NAME = 100;

/** The folder name for a source: lowercase, `[a-z0-9._-]` only, never empty or dot-leading. */
export const slugifySourceDirName = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_SOURCE_DIR_NAME)
    .replace(/[-.]+$/, '');

  return slug || 'source';
};
