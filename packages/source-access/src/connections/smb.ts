import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, open, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import { isWithinPath, normalizeWindowsPath } from '../windows-path';
import {
  type AllinfoBlock,
  SmbTreeParser,
  errorCodeOf,
  parseAllinfoOutput,
} from './smb-parse';
import {
  ConnectionError,
  type ConnectionDriver,
  type ConnectionTarget,
  type DirEntry,
  type FileInfo,
  type OpenStreamOptions,
  type TestResult,
  type TreeEntry,
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
      'paths containing ; or " cannot be addressed over SMB',
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

/**
 * The password goes in the child's environment (`PASSWD`), never argv, which
 * any local user can read from the process list. The rest of the caller's
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
    // allinfo and ls print times in the client's zone; UTC makes them absolute.
    TZ: 'UTC',
  },
});

/** `timeoutMs` null: the caller watches for stalls itself (long transfers). */
const spawnSmbclient = (
  target: ConnectionTarget,
  args: string[],
  timeoutMs: number | null = TIMEOUT_MS,
) => {
  const invocation = smbclientInvocation(target, args);
  const child = spawn('smbclient', invocation.args, {
    env: invocation.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const timer =
    timeoutMs === null
      ? undefined
      : setTimeout(() => child.kill('SIGKILL'), timeoutMs);

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

/**
 * Whether `allinfo` output describes a directory that exists. Windows answers
 * a listing of a folder the account may not list (an IIS app-pool profile,
 * say) with "not found", while `allinfo` on the same folder still works.
 */
export const reportsExistingDirectory = (allinfoOutput: string): boolean =>
  !/NT_STATUS_/.test(allinfoOutput) &&
  /^attributes:\s+[A-Z]*D[A-Z]*\s+\(/m.test(allinfoOutput);

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

/** How many paths one `allinfo` session takes; ~26 ms each in the M4 spike. */
export const ALLINFO_BATCH_SIZE = 100;
/** Command text per session, well under the 128 KB argument limit. */
const ALLINFO_BATCH_BYTES = 64 * 1024;
/** A recursive listing that prints nothing for this long is dead. */
const LIST_TREE_STALL_MS = 120_000;
const TAIL_BYTES = 512;

const toConnectionError = (err: unknown): ConnectionError =>
  err instanceof ConnectionError
    ? err
    : new ConnectionError(
        'failed',
        err instanceof Error ? err.message : String(err),
      );

// `in` rather than `ok`: apps compile this source without strictNullChecks,
// where unions discriminated on a literal do not narrow.
const blockToResult = (block: AllinfoBlock): FileInfo | ConnectionError =>
  'info' in block
    ? block.info
    : new ConnectionError(block.code, describeSmbError(block.message));

/** Splits `items` into batches by count and total command size. */
const batchesOf = <T extends { command: string }>(items: T[]): T[][] => {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;

  for (const item of items) {
    const size = Buffer.byteLength(item.command);

    if (
      current.length > 0 &&
      (current.length >= ALLINFO_BATCH_SIZE ||
        bytes + size > ALLINFO_BATCH_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);

  return batches;
};

/**
 * `allinfo` for paths of one share. If the output does not hold one block
 * per path (one failure can hide a neighbour's block), the batch is redone
 * one path at a time, where the output belongs to a single path.
 */
const allinfoShare = async (
  target: ConnectionTarget,
  share: string,
  relativePaths: string[],
): Promise<(FileInfo | ConnectionError)[]> => {
  const run = async (paths: string[]) => {
    const { output } = await runSmbclient(target, [
      `//${target.address}/${share}`,
      '-c',
      paths.map((path) => `allinfo "${path}"`).join(';'),
    ]);

    return { output, blocks: parseAllinfoOutput(output) };
  };

  const batch = await run(relativePaths);

  if (batch.blocks.length === relativePaths.length) {
    return batch.blocks.map(blockToResult);
  }

  const results: (FileInfo | ConnectionError)[] = [];

  for (const path of relativePaths) {
    const single = await run([path]);

    results.push(
      single.blocks.length === 1
        ? blockToResult(single.blocks[0])
        : new ConnectionError(
            errorCodeOf(single.output),
            describeSmbError(single.output),
          ),
    );
  }

  return results;
};

/**
 * Streams the output of one `get ... -`. With `-` smbclient prints errors on
 * **stdout**, in the middle of the data, and exits 1, so the exit code is the
 * only trustworthy signal: a non-zero exit destroys the stream with a
 * ConnectionError, and a consumer must not treat bytes seen before that as
 * the file. Exit 0 with fewer bytes than the file has can still happen, hence
 * the caller compares counts. Stalls count only while the consumer keeps up
 * (a full buffer is the consumer's wait, not the source's).
 */
const streamGet = (
  target: ConnectionTarget,
  share: string,
  command: string,
  options: OpenStreamOptions,
): Readable => {
  const child = spawnSmbclient(
    target,
    [`//${target.address}/${share}`, '-c', command],
    null,
  );
  const out = new PassThrough();
  let tail = '';
  let settled = false;
  let timer: NodeJS.Timeout | undefined;

  const settle = (err?: Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
    if (err) {
      child.kill('SIGKILL');
      out.destroy(err);
    } else {
      out.end();
    }
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (out.writableNeedDrain) return arm();
      settle(
        new ConnectionError(
          'stalled',
          `no data from the source for ${Math.round(options.stallTimeoutMs / 1000)} s`,
        ),
      );
    }, options.stallTimeoutMs);
  };
  const onAbort = () =>
    settle(
      options.signal?.reason instanceof Error
        ? options.signal.reason
        : new Error('transfer aborted'),
    );

  if (options.signal?.aborted) {
    onAbort();

    return out;
  }
  options.signal?.addEventListener('abort', onAbort, { once: true });
  out.on('drain', arm);
  out.on('close', () => {
    // The consumer stopped reading (or settle destroyed us): end the transfer.
    clearTimeout(timer);
    if (!settled) settled = true;
    child.kill('SIGKILL');
  });

  child.stdout.on('data', (chunk: Buffer) => {
    arm();
    tail = (tail + chunk.toString('latin1')).slice(-TAIL_BYTES);
  });
  child.stdout.pipe(out, { end: false });
  child.stderr.on('data', (chunk: Buffer) => {
    tail = (tail + chunk.toString('latin1')).slice(-TAIL_BYTES);
  });
  child.on('error', (err) =>
    settle(
      new ConnectionError(
        'failed',
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'smbclient is not installed on this host'
          : err.message,
      ),
    ),
  );
  child.on('close', (code) =>
    settle(
      code === 0
        ? undefined
        : new ConnectionError(errorCodeOf(tail), describeSmbError(tail)),
    ),
  );
  arm();

  return out;
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
      const code = errorCodeOf(output);

      if (code === 'not_found' && relativePath) {
        const { output: info } = await runSmbclient(target, [
          `//${target.address}/${share}`,
          '-c',
          `allinfo "${relativePath}"`,
        ]);

        if (reportsExistingDirectory(info)) {
          throw new ConnectionError(
            'auth',
            'The directory exists, but this account is not allowed to list it (the server reports it as not found)',
          );
        }
      }

      throw new ConnectionError(code, describeSmbError(output));
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

  async *listTree(target, path): AsyncGenerator<TreeEntry> {
    const { share, relativePath } = shareFor(target, path);
    const mask = relativePath ? `${relativePath}\\*` : '*';
    const child = spawnSmbclient(
      target,
      [`//${target.address}/${share}`, '-c', `recurse ON; ls "${mask}"`],
      null,
    );
    const parser = new SmbTreeParser(relativePath);
    const diagnostics: string[] = [];
    let stalled = false;
    let timer: NodeJS.Timeout | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        stalled = true;
        child.kill('SIGKILL');
      }, LIST_TREE_STALL_MS);
    };
    const exit = new Promise<number | null>((resolve) => {
      child.on('error', () => resolve(null));
      child.on('close', resolve);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (diagnostics.length < 8) diagnostics.push(chunk.toString());
    });
    arm();

    try {
      const lines = createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      for await (const line of lines) {
        arm();

        const entry = parser.push(line);

        if (entry?.kind === 'error' && entry.relPath === '') {
          throw new ConnectionError(
            entry.code,
            describeSmbError(entry.message),
          );
        }
        if (entry) {
          yield entry;
        } else if (/NT_STATUS_/.test(line) && diagnostics.length < 8) {
          diagnostics.push(line);
        }
      }

      const code = await exit;

      if (stalled) {
        throw new ConnectionError('stalled', 'the listing stopped answering');
      }
      if (code !== 0) {
        const text = diagnostics.join('\n');

        throw new ConnectionError(errorCodeOf(text), describeSmbError(text));
      }
    } finally {
      clearTimeout(timer);
      child.kill('SIGKILL');
    }
  },

  async allinfo(target, paths) {
    const results: (FileInfo | ConnectionError)[] = new Array(paths.length);
    const byShare = new Map<
      string,
      { index: number; relativePath: string; command: string }[]
    >();

    paths.forEach((path, index) => {
      try {
        const { share, relativePath } = shareFor(target, path);
        const items = byShare.get(share) ?? [];

        items.push({
          index,
          relativePath,
          command: `allinfo "${relativePath}";`,
        });
        byShare.set(share, items);
      } catch (err) {
        results[index] = toConnectionError(err);
      }
    });

    for (const [share, items] of byShare) {
      for (const batch of batchesOf(items)) {
        let batchResults: (FileInfo | ConnectionError)[];

        try {
          batchResults = await allinfoShare(
            target,
            share,
            batch.map((item) => item.relativePath),
          );
        } catch (err) {
          batchResults = batch.map(() => toConnectionError(err));
        }
        batch.forEach((item, i) => (results[item.index] = batchResults[i]));
      }
    }

    return results;
  },

  openStream(target, path, options): Readable {
    const { share, relativePath } = shareFor(target, path);

    return streamGet(target, share, `get "${relativePath}" -`, options);
  },

  async readNamedStream(target, path, streamName, maxBytes) {
    if (!/^[\w. -]+$/.test(streamName)) {
      throw new ConnectionError('unsupported_path', 'bad stream name');
    }

    const { share, relativePath } = shareFor(target, path);
    const stream = streamGet(
      target,
      share,
      `get "${relativePath}:${streamName}" -`,
      { stallTimeoutMs: TIMEOUT_MS },
    );
    const chunks: Buffer[] = [];
    let length = 0;

    try {
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
        length += (chunk as Buffer).length;
        if (length >= maxBytes) break;
      }
    } catch (err) {
      if (err instanceof ConnectionError && err.code === 'not_found') {
        return null;
      }
      throw err;
    } finally {
      stream.destroy();
    }

    return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8');
  },

  async readTail(target, path, size, bytes) {
    const { share, relativePath } = shareFor(target, path);
    const length = Math.min(size, bytes);
    const dir = await mkdtemp(join(tmpdir(), 'smb-tail-'));
    const local = join(dir, 'tail');

    try {
      // `reget` continues a download from the local file's length, so a
      // sparse file of the skipped length makes smbclient fetch only the tail.
      await writeFile(local, '');
      await truncate(local, size - length);

      const { output } = await runSmbclient(target, [
        `//${target.address}/${share}`,
        '-c',
        `reget "${relativePath}" "${local}"`,
      ]);

      if (/NT_STATUS_[A-Z_]+/.test(output)) {
        throw new ConnectionError(
          errorCodeOf(output),
          describeSmbError(output),
        );
      }

      // Read only the tail back: the file is as long as the original.
      const handle = await open(local, 'r');

      try {
        if ((await handle.stat()).size !== size) {
          throw new ConnectionError('failed', 'The file changed while reading');
        }

        const tail = Buffer.alloc(length);
        await handle.read(tail, 0, length, size - length);

        return tail;
      } finally {
        await handle.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};
