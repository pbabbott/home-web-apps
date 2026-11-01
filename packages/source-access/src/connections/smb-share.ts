import { isWithinPath, normalizeWindowsPath } from '../windows-path';
import { ConnectionError, type ConnectionTarget } from './types';

export type ResolvedShare = { share: string; relativePath: string };

/**
 * Which SMB share serves a Windows path, and the path inside it. Mappings
 * (`C:\Users` -> `Users`) win, longest prefix first; otherwise a drive path
 * uses its administrative share (`C:\` -> `C$`). A UNC path names its share
 * itself, but only on this machine. Returns null if nothing serves it.
 */
export const resolveShare = (
  path: string,
  mappings: { pathPrefix: string; share: string }[] = [],
  hostNames: string[] = [],
): ResolvedShare | null => {
  const { path: canonical, normalizedPath } = normalizeWindowsPath(path);

  if (canonical.startsWith('\\\\')) {
    const [server, share, ...rest] = canonical.slice(2).split('\\');

    return hostNames.some((name) => name.toLowerCase() === server.toLowerCase())
      ? { share, relativePath: rest.join('\\') }
      : null;
  }

  const matches = mappings
    .map((mapping) => ({
      share: mapping.share,
      prefix: normalizeWindowsPath(mapping.pathPrefix),
    }))
    .filter(({ prefix }) => isWithinPath(prefix.normalizedPath, normalizedPath))
    .sort((a, b) => b.prefix.path.length - a.prefix.path.length);

  const best = matches[0];

  if (best) {
    return {
      share: best.share,
      relativePath: canonical
        .slice(best.prefix.path.length)
        .replace(/^\\+/, ''),
    };
  }

  return { share: `${canonical[0]}$`, relativePath: canonical.slice(3) };
};

/**
 * smbclient takes commands as one `;`-separated string, so a `;` (or a
 * quote or line break) in a path could append a command of its own such as
 * `del`. Refuse those paths instead of trying to escape them.
 */
export const assertSafeForCommand = (relativePath: string): void => {
  if (/[;"\r\n\0]/.test(relativePath)) {
    throw new ConnectionError(
      'unsupported_path',
      'paths containing ; or " cannot be addressed over SMB',
    );
  }
};

export const shareFor = (
  target: ConnectionTarget,
  path: string,
): ResolvedShare => {
  const resolved = resolveShare(
    path,
    target.settings.shareMappings,
    target.hostNames,
  );

  if (!resolved) {
    throw new ConnectionError(
      'no_share',
      'No share is configured for this path',
    );
  }

  assertSafeForCommand(resolved.relativePath);

  return resolved;
};
