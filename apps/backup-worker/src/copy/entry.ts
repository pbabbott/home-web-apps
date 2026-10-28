import path from 'path';
import {
  captureBackupEntryMetadata,
  recordBackupEntryResult,
  type BackupEntry,
  type BackupEntryResult,
} from '@abbottland/homelab-db';
import { ConnectionError, type FileInfo } from '@abbottland/source-access';
import { UnsafePathError } from '../lib/safe-path';
import { assertLive, claimTokenOf, type CopyContext } from './context';
import {
  DestConflictError,
  DestWriteError,
  EntryFailure,
  SourceUnreachableError,
} from './errors';
import {
  destAbs,
  entryDestRel,
  entrySourcePath,
  keepBothRel,
  stagingFile,
} from './layout';

/** `Zone.Identifier` is a few dozen bytes; the database keeps 4 KiB of it. */
const ZONE_IDENTIFIER = 'Zone.Identifier';
const ZONE_IDENTIFIER_MAX_BYTES = 4096;
/** Writing the same instant: whole seconds, which is what the source reports. */
const sameSecond = (a: Date, b: Date) =>
  Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000);

const mapSourceError = (err: ConnectionError): EntryFailure | Error => {
  switch (err.code) {
    case 'not_found':
      return new EntryFailure('source_missing', err.message);
    case 'unsupported_path':
      return new EntryFailure('unsupported_path', err.message);
    case 'unreachable':
      return new SourceUnreachableError(err.message);
    default:
      return new EntryFailure('read_failed', err.message);
  }
};

/**
 * The failure to record on the entry for an error we know how to describe;
 * undefined for anything else (a crash, a lost claim, a bug), which must
 * propagate. A source that stopped answering is thrown, not recorded.
 */
const toEntryFailure = (err: unknown): EntryFailure | undefined => {
  if (err instanceof EntryFailure) return err;
  if (err instanceof ConnectionError) {
    const mapped = mapSourceError(err);
    if (mapped instanceof EntryFailure) return mapped;
    throw mapped;
  }
  if (err instanceof DestWriteError) {
    return new EntryFailure('write_failed', err.message);
  }
  if (err instanceof DestConflictError) {
    return new EntryFailure('dest_conflict', err.message);
  }
  if (err instanceof UnsafePathError) {
    return new EntryFailure('unsupported_path', err.message);
  }

  return undefined;
};

const record = (
  ctx: CopyContext,
  entry: BackupEntry,
  result: BackupEntryResult,
) =>
  recordBackupEntryResult(ctx.db, entry.id, {
    claimToken: claimTokenOf(ctx),
    attempt: ctx.item.attemptCount,
    result,
  });

/**
 * Records what the source says about the entry, once: a retry finds it
 * recorded and leaves it (and the query would not overwrite it anyway). This
 * runs before the file is read, because reading changes its access time on
 * the source. `Zone.Identifier` is read after the times are safe.
 */
const captureMetadata = async (
  ctx: CopyContext,
  entry: BackupEntry,
  info: FileInfo,
): Promise<void> => {
  if (!entry.srcCreatedAt) {
    await captureBackupEntryMetadata(ctx.db, entry.id, {
      claimToken: claimTokenOf(ctx),
      metadata: {
        srcCreatedAt: info.createdAt,
        srcModifiedAt: info.modifiedAt,
        srcAccessedAt: info.accessedAt,
        srcChangedAt: info.changedAt,
        srcAttributes: info.attributes,
        srcStreams: info.streams,
      },
    });
  }

  if (
    entry.entryType === 'file' &&
    entry.srcZoneIdentifier == null &&
    info.streams.some((stream) => stream.name === ZONE_IDENTIFIER)
  ) {
    const text = await ctx.driver.readNamedStream(
      ctx.target,
      entrySourcePath(ctx.item.rootPath, entry.relPath),
      ZONE_IDENTIFIER,
      ZONE_IDENTIFIER_MAX_BYTES,
    );

    if (text !== null) {
      await captureBackupEntryMetadata(ctx.db, entry.id, {
        claimToken: claimTokenOf(ctx),
        metadata: { srcZoneIdentifier: text },
      });
    }
  }
};

const makeDirectory = async (
  ctx: CopyContext,
  entry: BackupEntry,
): Promise<BackupEntryResult> => {
  const rel = entryDestRel(ctx.item.destRelPath, entry.relPath);

  await ctx.dest.ensureDir(
    destAbs(ctx.dest.baseRoot, ctx.job.sourceDirName, rel),
  );

  return { status: 'verified', destRelPath: rel };
};

/**
 * §4.3 steps 2 to 7 for one file: stream the source into the staging folder
 * (hashing as it goes), place it without clobbering, set the modified time,
 * and read it back. Existing destination files are never touched: identical
 * content is adopted, different content makes the copy go to a suffixed name.
 */
const copyFile = async (
  ctx: CopyContext,
  entry: BackupEntry,
  info: FileInfo,
): Promise<BackupEntryResult> => {
  const { dest, job, item } = ctx;
  const rel = entryDestRel(item.destRelPath, entry.relPath);
  const sourcePath = entrySourcePath(item.rootPath, entry.relPath);
  const modifiedAt = entry.srcModifiedAt ?? info.modifiedAt;
  const size = info.size;
  const absOf = (r: string) => destAbs(dest.baseRoot, job.sourceDirName, r);

  await dest.ensureDir(path.dirname(absOf(rel)));

  let staged: { file: string; sha256: string } | undefined;

  const stage = async () => {
    if (staged) return staged;
    const file = stagingFile(dest.baseRoot, item.id, entry.id);
    const source = ctx.driver.openStream(ctx.target, sourcePath, {
      stallTimeoutMs: ctx.stallTimeoutMs,
      signal: ctx.signal,
    });

    try {
      const result = await dest.stage(file, source, () =>
        ctx.fault('stage:chunk', entry.relPath),
      );

      if (result.bytes !== size) {
        throw new EntryFailure(
          'read_failed',
          `the source stream ended after ${result.bytes} of ${size} bytes`,
        );
      }
      staged = { file, sha256: result.sha256 };
    } finally {
      source.destroy();
    }
    await ctx.fault('entry:after-stage', entry.relPath);

    return staged;
  };

  // Index 0 is the mirrored path, index 1 the keep-both name.
  for (let index = 0; index < 2; index++) {
    const candidateRel = index === 0 ? rel : keepBothRel(rel, job.id);
    const abs = absOf(candidateRel);
    const result: Pick<BackupEntryResult, 'issueKind'> = {
      issueKind: index === 1 ? 'kept_both' : null,
    };

    // A placed link that loses a race (EEXIST) is looked at again.
    for (let tries = 0; tries < 3; tries++) {
      assertLive(ctx);
      const existing = await dest.lstat(abs);

      if (!existing) {
        const { file, sha256 } = await stage();

        if (!(await dest.link(file, abs))) continue;
        await ctx.fault('entry:after-link', entry.relPath);
        await dest.unlink(file);
        await ctx.fault('entry:after-unlink', entry.relPath);
        await dest.utimes(abs, modifiedAt);
        await ctx.fault('entry:after-utimes', entry.relPath);

        const written = await dest.hashFile(abs);

        if (written.sha256 !== sha256 || written.bytes !== size) {
          // Only the file this attempt created.
          await dest.unlink(abs);
          throw new EntryFailure(
            'verify_mismatch',
            'the destination file read back differently from the source stream',
          );
        }
        await ctx.fault('entry:after-verify', entry.relPath);

        return {
          status: 'verified',
          sizeBytes: size,
          sha256,
          destRelPath: candidateRel,
          ...result,
        };
      }

      if (existing.isSymbolicLink()) {
        throw new EntryFailure(
          'unsupported_path',
          `${candidateRel} is a symbolic link`,
        );
      }
      if (!existing.isFile()) {
        throw new EntryFailure(
          'dest_conflict',
          `${candidateRel} is a directory where a file must go`,
        );
      }

      if (existing.size === size) {
        const { file, sha256 } = await stage();
        const present = await dest.hashFile(abs);

        if (present.sha256 === sha256 && present.bytes === size) {
          await dest.unlink(file);
          // An earlier attempt may have been killed before it set the time.
          if (!sameSecond(existing.mtime, modifiedAt)) {
            await dest.utimes(abs, modifiedAt);
          }

          return {
            status: 'verified',
            sizeBytes: size,
            sha256,
            destRelPath: candidateRel,
            ...result,
          };
        }
      }
      break;
    }

    if (index === 1) {
      throw new EntryFailure(
        'dest_conflict',
        `${rel} and its keep-both name both hold different content`,
      );
    }
  }

  throw new EntryFailure('dest_conflict', `${rel} could not be placed`);
};

/**
 * Copies one entry and records the result. A failure that belongs to the
 * entry (source missing, read failed, destination conflict, ...) is recorded
 * on it and the item carries on; anything else, including a fault injected by
 * a test, propagates and leaves the item for the lease to expire.
 */
export const processEntry = async (
  ctx: CopyContext,
  entry: BackupEntry,
  info: FileInfo | ConnectionError,
): Promise<void> => {
  assertLive(ctx);
  await ctx.fault('entry:start', entry.relPath);

  try {
    if (info instanceof ConnectionError) throw info;

    if (info.isReparsePoint) {
      await record(ctx, entry, {
        status: 'not_followed',
        issueKind: 'reparse_point_not_followed',
        message: 'a junction or symbolic link is not followed',
      });

      return;
    }

    await captureMetadata(ctx, entry, info);
    await ctx.fault('entry:after-metadata', entry.relPath);

    const result =
      entry.entryType === 'directory'
        ? await makeDirectory(ctx, entry)
        : await copyFile(ctx, entry, info);

    await ctx.fault('entry:before-record', entry.relPath);
    await record(ctx, entry, result);
    await ctx.fault('entry:after-record', entry.relPath);
  } catch (err) {
    const failure = toEntryFailure(err);

    if (!failure) throw err;

    await ctx.dest
      .unlink(stagingFile(ctx.dest.baseRoot, ctx.item.id, entry.id))
      .catch(() => undefined);
    await record(ctx, entry, {
      status: 'failed',
      issueKind: failure.issueKind,
      message: failure.message,
    });
  }
};
