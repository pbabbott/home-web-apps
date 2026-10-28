import { createHash } from 'crypto';
import fsPromises from 'fs/promises';
import type { Stats } from 'fs';
import path from 'path';
import { assertNoSymlinks, UnsafePathError } from '../lib/safe-path';
import {
  DestConflictError,
  DestinationUnhealthyError,
  DestWriteError,
  EntryFailure,
} from './errors';
import { STAGING_DIR } from './layout';

/** The filesystem calls the copy makes, so tests can inject faults. */
export type CopyFs = Pick<
  typeof fsPromises,
  | 'lstat'
  | 'mkdir'
  | 'open'
  | 'link'
  | 'unlink'
  | 'utimes'
  | 'rm'
  | 'rmdir'
  | 'readdir'
>;

export type DestFsDeps = {
  fs: CopyFs;
  /** Wraps each destination call, so the watchdog sees it. */
  run: <T>(operation: string, fn: () => Promise<T>) => Promise<T>;
};

export const defaultDestFsDeps = (
  run: DestFsDeps['run'] = (_operation, fn) => fn(),
): DestFsDeps => ({ fs: fsPromises, run });

const READ_CHUNK = 1024 * 1024;

const errnoOf = (err: unknown): string =>
  (err as NodeJS.ErrnoException)?.code ?? 'ERROR';

/** An I/O error, a stale or lost mount, no space or a read-only mount: the whole destination is broken. */
const DESTINATION_WIDE_ERRNO = new Set([
  'EIO',
  'ESTALE',
  'ENOTCONN',
  'ENOSPC',
  'EDQUOT',
  'EROFS',
]);

/**
 * Every destination operation of the copy. Each call runs under the watchdog
 * on its own (never a whole file: a 500 MB file legitimately takes minutes,
 * a single write that takes minutes means the mount hangs). Failures of the
 * filesystem come out as `DestWriteError` with the errno, so callers can tell
 * them from source errors that pass through a streamed copy untouched.
 */
export class DestFs {
  /** Directories verified free of symlinks during this process. */
  private readonly knownDirs = new Set<string>();

  constructor(
    /** The mount point (`BACKUP_DESTINATION_PATH`). */
    readonly mountRoot: string,
    /** `<mount>/<root_dir>`: where `<source_dir_name>/` and the staging folder live. */
    readonly baseRoot: string,
    private readonly deps: DestFsDeps = defaultDestFsDeps(),
  ) {}

  /**
   * Whether a failure of `abs` says something about the whole destination.
   * Access errors count only where every copy depends on it (the mount, the
   * root folder, the source folder's parent and the staging area); under the
   * source's own folder they belong to one file.
   */
  private isDestinationWide(code: string, abs: string): boolean {
    if (DESTINATION_WIDE_ERRNO.has(code)) return true;

    const target = path.resolve(abs);
    const staging = path.join(this.baseRoot, STAGING_DIR);

    if (code === 'ENOENT') return target === path.resolve(this.mountRoot);
    if (code === 'EACCES' || code === 'EPERM') {
      return (
        target === path.resolve(this.mountRoot) ||
        target === path.resolve(this.baseRoot) ||
        path.dirname(target) === path.resolve(this.baseRoot) ||
        target === staging ||
        target.startsWith(staging + path.sep)
      );
    }

    return false;
  }

  private failure(operation: string, abs: string, err: unknown): Error {
    const code = errnoOf(err);
    const message = `${operation}: ${code}: ${err instanceof Error ? err.message : String(err)}`;

    return this.isDestinationWide(code, abs)
      ? new DestinationUnhealthyError(operation, code, message)
      : new DestWriteError(operation, code, message);
  }

  private async call<T>(
    operation: string,
    abs: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.deps.run(operation, fn);
    } catch (err) {
      if (
        err instanceof DestWriteError ||
        err instanceof DestinationUnhealthyError ||
        err instanceof EntryFailure ||
        err instanceof DestConflictError ||
        err instanceof UnsafePathError
      ) {
        throw err;
      }
      throw this.failure(operation, abs, err);
    }
  }

  /** The `lstat` of a path, or null when it does not exist. */
  async lstat(abs: string): Promise<Stats | null> {
    try {
      return await this.deps.run('lstat', () => this.deps.fs.lstat(abs));
    } catch (err) {
      if (errnoOf(err) === 'ENOENT' || errnoOf(err) === 'ENOTDIR') return null;
      throw this.failure('lstat', abs, err);
    }
  }

  /**
   * Refuses a base folder that has a symlink on the way (checked once per
   * item), and a mount point that is not there: writing would then create it
   * in the container's own filesystem.
   */
  async assertBaseSafe(): Promise<void> {
    if (!(await this.lstat(this.mountRoot))) {
      throw new DestinationUnhealthyError(
        'lstat',
        'ENOENT',
        `lstat: ENOENT: the destination ${this.mountRoot} does not exist`,
      );
    }
    await assertNoSymlinks(this.mountRoot, this.baseRoot, (p) =>
      this.call('lstat', p, () => this.deps.fs.lstat(p)),
    );
  }

  /**
   * Creates `abs` and its missing parents below the base folder, checking
   * every component on the way: a symlink is refused, a file where a directory
   * must be is a `DestConflictError`. Directories already checked are not
   * checked again.
   */
  async ensureDir(abs: string): Promise<void> {
    const relative = path.relative(this.baseRoot, abs);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new UnsafePathError(`${abs} is outside ${this.baseRoot}`);
    }
    if (relative === '' || this.knownDirs.has(abs)) return;

    let current = this.baseRoot;

    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      if (this.knownDirs.has(current)) continue;

      let stat = await this.lstat(current);

      if (!stat) {
        try {
          await this.call('mkdir', current, () => this.deps.fs.mkdir(current));
        } catch (err) {
          // Someone else made it between our lstat and mkdir: look again.
          if (!(err instanceof DestWriteError && err.code === 'EEXIST')) {
            throw err;
          }
        }
        stat = await this.lstat(current);
      }
      if (!stat) {
        throw new DestWriteError(
          'mkdir',
          'ENOENT',
          `mkdir: ${current} vanished after it was created`,
        );
      }
      if (stat.isSymbolicLink()) {
        throw new UnsafePathError(`${current} is a symbolic link`);
      }
      if (!stat.isDirectory()) {
        throw new DestConflictError(
          `${current} is a file where a directory must be`,
        );
      }
      this.knownDirs.add(current);
    }
  }

  /**
   * Writes the stream to `file` (replacing a leftover of our own), hashing
   * what it writes, then fsyncs. Returns the SHA-256 and byte count. Errors
   * thrown by the source stream propagate unchanged. `onChunk` runs after
   * each chunk (tests use it to crash mid-file). The file is not removed on
   * failure: the caller owns cleanup, and a crash leaves it for the next
   * attempt to delete.
   */
  async stage(
    file: string,
    source: AsyncIterable<Buffer>,
    onChunk?: () => void | Promise<void>,
    signal?: AbortSignal,
  ): Promise<{ sha256: string; bytes: number }> {
    await this.call('mkdir', path.dirname(file), () =>
      this.deps.fs.mkdir(path.dirname(file), { recursive: true }),
    );
    const handle = await this.call('open', file, () =>
      this.deps.fs.open(file, 'w'),
    );
    const hash = createHash('sha256');
    let bytes = 0;

    try {
      for await (const chunk of source) {
        signal?.throwIfAborted();
        hash.update(chunk);
        let offset = 0;

        while (offset < chunk.length) {
          const written = await this.call('write', file, () =>
            handle.write(chunk, offset, chunk.length - offset),
          );

          offset += written.bytesWritten;
        }
        bytes += chunk.length;
        await onChunk?.();
      }
      await this.call('fsync', file, () => handle.sync());
    } finally {
      await this.call('close', file, () => handle.close()).catch(
        () => undefined,
      );
    }

    return { sha256: hash.digest('hex'), bytes };
  }

  /** Reads a file back and hashes it. */
  async hashFile(
    abs: string,
    signal?: AbortSignal,
  ): Promise<{ sha256: string; bytes: number }> {
    const handle = await this.call('open', abs, () =>
      this.deps.fs.open(abs, 'r'),
    );
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(READ_CHUNK);
    let bytes = 0;

    try {
      for (;;) {
        signal?.throwIfAborted();
        const { bytesRead } = await this.call('read', abs, () =>
          handle.read(buffer, 0, READ_CHUNK, null),
        );

        if (bytesRead === 0) break;
        hash.update(buffer.subarray(0, bytesRead));
        bytes += bytesRead;
      }
    } finally {
      await this.call('close', abs, () => handle.close()).catch(
        () => undefined,
      );
    }

    return { sha256: hash.digest('hex'), bytes };
  }

  /** Hard-links `from` to `to`; returns false if `to` already exists (never clobbers). */
  async link(from: string, to: string): Promise<boolean> {
    try {
      await this.call('link', to, () => this.deps.fs.link(from, to));

      return true;
    } catch (err) {
      if (err instanceof DestWriteError && err.code === 'EEXIST') return false;
      throw err;
    }
  }

  async unlink(abs: string): Promise<void> {
    try {
      await this.call('unlink', abs, () => this.deps.fs.unlink(abs));
    } catch (err) {
      if (!(err instanceof DestWriteError && err.code === 'ENOENT')) throw err;
    }
  }

  async utimes(abs: string, time: Date): Promise<void> {
    await this.call('utimes', abs, () => this.deps.fs.utimes(abs, time, time));
  }

  /** The item ids that have a staging folder (leftovers of killed attempts). */
  async listStaging(): Promise<string[]> {
    const root = path.join(this.baseRoot, STAGING_DIR);

    try {
      return await this.call('readdir', root, () => this.deps.fs.readdir(root));
    } catch (err) {
      if (err instanceof DestWriteError && err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /** Deletes the staging folder of an item (leftovers of a killed attempt). */
  async removeItemStaging(stagingItemDir: string): Promise<void> {
    await this.call('rm', stagingItemDir, () =>
      this.deps.fs.rm(stagingItemDir, { recursive: true, force: true }),
    );
  }

  /** Removes `.exodus-staging` when nothing else is in it. */
  async removeStagingRootIfEmpty(): Promise<void> {
    const root = path.join(this.baseRoot, STAGING_DIR);

    try {
      await this.call('rmdir', root, () => this.deps.fs.rmdir(root));
    } catch (err) {
      if (
        err instanceof DestWriteError &&
        ['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(err.code)
      ) {
        return;
      }
      throw err;
    }
  }
}
