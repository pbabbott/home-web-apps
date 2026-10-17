export type NormalizedWindowsPath = {
  /** Canonical display form: single backslashes, no trailing slash, uppercase drive letter. */
  path: string;
  /** `path` lowercased — the key paths are deduplicated and compared by. */
  normalizedPath: string;
};

export class InvalidWindowsPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWindowsPathError';
  }
}

const DRIVE_ROOT = /^[A-Za-z]:\\$/;
const DRIVE_PATH = /^[A-Za-z]:\\/;
const UNC_PATH = /^\\\\[^\\]+\\[^\\]+(\\|$)/;
const INVALID_SEGMENT_CHARS = /[<>:"|?*]/;

const hasControlCharacter = (value: string): boolean =>
  [...value].some((char) => char.charCodeAt(0) < 32);

/**
 * Canonicalizes an absolute Windows path (`C:\…` or UNC `\\server\share\…`)
 * so that spellings differing only in slash style, repeated or trailing
 * separators, or case map to the same `normalizedPath`. Rejects relative
 * paths, `.`/`..` segments, device-namespace prefixes (`\\?\`, `\\.\`) and
 * characters Windows does not allow in names.
 */
export const normalizeWindowsPath = (input: string): NormalizedWindowsPath => {
  const slashed = input.trim().replace(/\//g, '\\');

  if (slashed.startsWith('\\\\?\\') || slashed.startsWith('\\\\.\\')) {
    throw new InvalidWindowsPathError(
      'device-namespace paths (\\\\?\\, \\\\.\\) are not supported',
    );
  }

  const isUnc = slashed.startsWith('\\\\');
  // Collapse repeated separators, but keep the UNC prefix's leading pair.
  let path =
    (isUnc ? '\\\\' : '') + slashed.slice(isUnc ? 2 : 0).replace(/\\+/g, '\\');

  if (path.length > 1 && path.endsWith('\\') && !DRIVE_ROOT.test(path)) {
    path = path.slice(0, -1);
  }

  const isDrive = DRIVE_PATH.test(path);

  if (!isDrive && !UNC_PATH.test(path)) {
    throw new InvalidWindowsPathError(
      'path must be absolute: C:\\folder or \\\\server\\share\\folder',
    );
  }

  const segments = path
    .slice(isDrive ? 3 : 2)
    .split('\\')
    .filter(Boolean);

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new InvalidWindowsPathError(
        'path must not contain . or .. segments',
      );
    }
    if (INVALID_SEGMENT_CHARS.test(segment) || hasControlCharacter(segment)) {
      throw new InvalidWindowsPathError(
        `path segment "${segment}" contains characters Windows does not allow`,
      );
    }
  }

  if (isDrive) path = path[0].toUpperCase() + path.slice(1);

  return { path, normalizedPath: path.toLowerCase() };
};

/**
 * True if `child` is `parent` or lies beneath it, comparing normalized
 * paths on directory boundaries — `c:\users\you` contains `c:\users\you\docs`
 * but not `c:\users\youother`.
 */
export const isWithinPath = (
  parentNormalized: string,
  childNormalized: string,
): boolean => {
  if (childNormalized === parentNormalized) return true;

  const prefix = parentNormalized.endsWith('\\')
    ? parentNormalized
    : `${parentNormalized}\\`;

  return childNormalized.startsWith(prefix);
};
