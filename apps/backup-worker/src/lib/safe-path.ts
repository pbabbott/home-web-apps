import path from 'path';

/**
 * Resolves `requestedPath` relative to `root` and confirms the result stays
 * within `root`. Rejects `..` traversal, absolute-path overrides, and null
 * bytes. Returns `null` when the resolved path would escape `root`.
 */
export const resolveWithinRoot = (
  root: string,
  requestedPath: string,
): string | null => {
  if (requestedPath.includes('\0')) return null;

  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(path.join(resolvedRoot, requestedPath));

  const isRoot = resolvedTarget === resolvedRoot;
  const isWithinRoot = resolvedTarget.startsWith(resolvedRoot + path.sep);

  if (!isRoot && !isWithinRoot) return null;

  return resolvedTarget;
};

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafePathError';
  }
}

export type LstatLike = (p: string) => Promise<{ isSymbolicLink(): boolean }>;

/**
 * Walks every component of `target` below `root` and throws if an existing
 * one is a symlink (a missing component ends the walk: there is nothing to
 * follow yet). `root` itself is not checked: it is the mount point, and a
 * mount may legitimately be reached through a link. `target` must already be
 * confirmed within `root` (see `resolveWithinRoot`).
 */
export const assertNoSymlinks = async (
  root: string,
  target: string,
  lstat: LstatLike,
): Promise<void> => {
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, path.resolve(target));

  if (relative === '') return;
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UnsafePathError(`${target} is outside ${root}`);
  }

  let current = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);

    let stat;
    try {
      stat = await lstat(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }

    if (stat.isSymbolicLink()) {
      throw new UnsafePathError(`${current} is a symbolic link`);
    }
  }
};
