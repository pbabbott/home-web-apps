import { createInterface } from 'node:readline';
import { mkdtemp, open, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import {
  ALLINFO_BATCH_SIZE,
  batchesOf,
  allinfoShare,
  parseSmbListing,
  reportsExistingDirectory,
} from './smb-allinfo';
import { SmbTreeParser, errorCodeOf } from './smb-parse';
import {
  TIMEOUT_MS,
  describeSmbError,
  runSmbclient,
  smbclientInvocation,
  spawnSmbclient,
  toConnectionError,
} from './smb-process';
import { resolveShare, shareFor, type ResolvedShare } from './smb-share';
import { streamGet } from './smb-stream';
import {
  ConnectionError,
  type ConnectionDriver,
  type FileInfo,
  type TestResult,
  type TreeEntry,
} from './types';

// The pieces live in smb-*.ts; re-exported so importers keep one entry point.
export {
  ALLINFO_BATCH_SIZE,
  describeSmbError,
  parseSmbListing,
  reportsExistingDirectory,
  resolveShare,
  smbclientInvocation,
  type ResolvedShare,
};

const SIZE_PATTERN = /stream: \[::\$DATA\], (\d+) bytes/;

/** A recursive listing that prints nothing for this long is dead. */
const LIST_TREE_STALL_MS = 120_000;

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
