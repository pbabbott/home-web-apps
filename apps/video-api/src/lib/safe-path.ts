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
