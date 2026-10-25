import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { isWithinPath, normalizeWindowsPath } from '../windows-path';
import {
  ConnectionError,
  type ConnectionDriver,
  type ConnectionTarget,
  type DirEntry,
  type TestResult,
} from './types';

const TIMEOUT_MS = 30_000;

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
const assertSafeForCommand = (relativePath: string): void => {
  if (/[;"\r\n\0]/.test(relativePath)) {
    throw new ConnectionError(
      'unsupported_path',
      'paths containing ; or " cannot be previewed',
    );
  }
};

/** Turns smbclient output into a message a person can act on. */
export const describeSmbError = (output: string): string => {
  const status = /NT_STATUS_[A-Z_]+/.exec(output)?.[0];

  switch (status) {
    case 'NT_STATUS_LOGON_FAILURE':
      return 'Login failed: wrong username or password';
    case 'NT_STATUS_ACCOUNT_LOCKED_OUT':
      return 'The account is locked out';
    case 'NT_STATUS_ACCESS_DENIED':
      return 'Access denied (for a local account the share may need to be shared with this user)';
    case 'NT_STATUS_BAD_NETWORK_NAME':
      return 'The share does not exist on that machine';
    case 'NT_STATUS_OBJECT_NAME_NOT_FOUND':
    case 'NT_STATUS_OBJECT_PATH_NOT_FOUND':
      return 'File not found on the source';
    case 'NT_STATUS_HOST_UNREACHABLE':
    case 'NT_STATUS_IO_TIMEOUT':
    case 'NT_STATUS_CONNECTION_REFUSED':
    case 'NT_STATUS_UNSUCCESSFUL':
      return 'Could not reach the machine over SMB';
    default:
      return status ?? (output.trim().split('\n')[0] || 'smbclient failed');
  }
};

const errorCodeOf = (output: string): ConnectionError['code'] => {
  if (/LOGON_FAILURE|ACCOUNT_LOCKED_OUT|ACCESS_DENIED/.test(output)) {
    return 'auth';
  }
  if (/NOT_FOUND/.test(output)) return 'not_found';
  if (/BAD_NETWORK_NAME/.test(output)) return 'no_share';
  if (/UNREACHABLE|IO_TIMEOUT|CONNECTION_REFUSED|UNSUCCESSFUL/.test(output)) {
    return 'unreachable';
  }

  return 'failed';
};

/**
 * The password goes in the child's environment (`PASSWD`), never argv, which
 * any local user can read from the process list. The rest of the API's
 * environment (database password, etc.) is not passed on.
 */
export const smbclientInvocation = (
  target: ConnectionTarget,
  args: string[],
): { args: string[]; env: NodeJS.ProcessEnv } => ({
  args: [
    ...args,
    '-U',
    target.domain ? `${target.domain}\\${target.username}` : target.username,
    '-m',
    'SMB3',
  ],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PASSWD: target.password,
  },
});

const spawnSmbclient = (target: ConnectionTarget, args: string[]) => {
  const invocation = smbclientInvocation(target, args);
  const child = spawn('smbclient', invocation.args, {
    env: invocation.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);

  child.on('close', () => clearTimeout(timer));

  return child;
};

const runSmbclient = (
  target: ConnectionTarget,
  args: string[],
): Promise<{ output: string; code: number | null }> =>
  new Promise((resolve, reject) => {
    const child = spawnSmbclient(target, args);
    let output = '';

    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', (err) =>
      reject(
        new ConnectionError(
          'failed',
          (err as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'smbclient is not installed on the API host'
            : err.message,
        ),
      ),
    );
    child.on('close', (code) => resolve({ output, code }));
  });

const shareFor = (target: ConnectionTarget, path: string): ResolvedShare => {
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

const SIZE_PATTERN = /stream: \[::\$DATA\], (\d+) bytes/;

// `  name with spaces   AH   1234  Tue Mar  4 10:11:12 2025`
const LS_LINE =
  /^ {2}(.+?)\s+([ADHSRNI]*)\s+(\d+)\s+\w{3} (\w{3}) ([ \d]\d) (\d\d:\d\d:\d\d) (\d{4})$/;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Parses `smbclient ls` output. Lines that are not entries (summary, errors) are ignored. */
export const parseSmbListing = (output: string): DirEntry[] => {
  const entries: DirEntry[] = [];

  for (const line of output.split(/\r?\n/)) {
    const match = LS_LINE.exec(line);

    if (!match) continue;

    const [, name, flags, size, month, day, time, year] = match;

    if (name === '.' || name === '..') continue;

    const monthIndex = MONTHS.indexOf(month);

    entries.push({
      name,
      isDirectory: flags.includes('D'),
      size: Number(size),
      modifiedAt:
        monthIndex < 0
          ? null
          : `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.trim().padStart(2, '0')}T${time}`,
    });
  }

  return entries;
};

export const smbDriver: ConnectionDriver = {
  async test(target): Promise<TestResult> {
    const mapped = target.settings.shareMappings ?? [];
    const shares = mapped.length
      ? [...new Set(mapped.map((mapping) => mapping.share))]
      : ['C$'];

    try {
      for (const share of shares) {
        const { output } = await runSmbclient(target, [
          `//${target.address}/${share}`,
          '-c',
          'ls',
        ]);

        if (/NT_STATUS_[A-Z_]+/.test(output)) {
          return {
            ok: false,
            error: `Share "${share}": ${describeSmbError(output)}`,
          };
        }
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'connection test failed',
      };
    }
  },

  async stat(target, path) {
    const { share, relativePath } = shareFor(target, path);
    const { output } = await runSmbclient(target, [
      `//${target.address}/${share}`,
      '-c',
      `allinfo "${relativePath}"`,
    ]);
    const size = SIZE_PATTERN.exec(output)?.[1];

    if (size === undefined) {
      throw new ConnectionError(errorCodeOf(output), describeSmbError(output));
    }

    return { size: Number(size) };
  },

  async list(target, path) {
    const { share, relativePath } = shareFor(target, path);
    const mask = relativePath ? `${relativePath}\\*` : '*';
    const { output } = await runSmbclient(target, [
      `//${target.address}/${share}`,
      '-c',
      `ls "${mask}"`,
    ]);
    const entries = parseSmbListing(output);

    if (entries.length === 0 && /NT_STATUS_[A-Z_]+/.test(output)) {
      throw new ConnectionError(errorCodeOf(output), describeSmbError(output));
    }

    return entries;
  },

  open(target, path): Readable {
    const { share, relativePath } = shareFor(target, path);
    const child = spawnSmbclient(target, [
      `//${target.address}/${share}`,
      '-c',
      `get "${relativePath}" -`,
    ]);

    // A consumer that stops reading (size cap, closed tab) ends the transfer.
    child.stdout.on('close', () => child.kill('SIGKILL'));
    child.stdout.on('error', () => child.kill('SIGKILL'));

    return child.stdout;
  },
};
