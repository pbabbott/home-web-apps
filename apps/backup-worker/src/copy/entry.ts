import type { Stats } from 'fs';
import path from 'path';
import {
  captureBackupEntryMetadata,
  recordBackupEntryResult,
  recordBackupEntryStaged,
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
/** How often a link that loses a race is looked at again before giving up. */
const LINK_RACE_TRIES = 3;
/** Whether two instants fall in the same whole second, the precision the source reports. */
const sameSecond = (a: Date, b: Date) =>
  Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000);

/**
 * What changed about a file between the attempt that first described it and
 * this one (a retry after an interruption can be hours later), or null. The
 * copy is of the file as it is now; the entry keeps the earlier times, so the
 * difference stays on record.
 */
const changeSincePreviousRead = (
  entry: BackupEntry,
  info: FileInfo,
): string | null => {
  const changes: string[] = [];

  if (
    entry.srcModifiedAt &&
    !sameSecond(entry.srcModifiedAt, info.modifiedAt)
  ) {
    changes.push(
      `modified ${entry.srcModifiedAt.toISOString()} -> ${info.modifiedAt.toISOString()}`,
    );
  }
  if (entry.sizeBytes != null && entry.sizeBytes !== info.size) {
    changes.push(`size ${entry.sizeBytes} -> ${info.size}`);
  }

  return changes.length > 0
    ? `the source changed since it was first read (${changes.join(', ')})`
    : null;
};

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

/** What `copyFile` knows about one file, shared by the steps below. */
type FilePlan = {
  ctx: CopyContext;
  entry: BackupEntry;
  /** The bytes copied and the time applied come from this attempt's view of the file; `entry.src_*` keeps what the first attempt saw. */
  size: number;
  modifiedAt: Date;
  /** How the source differs from the first read, or null. */
  changed: string | null;
  staging: Staging;
};

/**
 * The source streamed into the staging folder, at most once per attempt:
 * every step that needs the content (placing it, comparing it with a file
 * already there) asks for it and gets the same staged file.
 */
class Staging {
  private staged: { file: string; sha256: string } | undefined;

  constructor(
    private readonly ctx: CopyContext,
    private readonly entry: BackupEntry,
    private readonly size: number,
  ) {}

  async get(): Promise<{ file: string; sha256: string }> {
    if (this.staged) return this.staged;

    const { ctx, entry } = this;
    const file = stagingFile(ctx.dest.baseRoot, ctx.item.id, entry.id);
    const source = ctx.driver.openStream(
      ctx.target,
      entrySourcePath(ctx.item.rootPath, entry.relPath),
      { stallTimeoutMs: ctx.stallTimeoutMs, signal: ctx.signal },
    );

    try {
      const result = await ctx.dest.stage(
        file,
        source,
        () => ctx.fault('stage:chunk', entry.relPath),
        ctx.signal,
      );

      if (result.bytes !== this.size) {
        throw new EntryFailure(
          'read_failed',
          `the source stream ended after ${result.bytes} of ${this.size} bytes`,
        );
      }
      this.staged = { file, sha256: result.sha256 };
      await recordBackupEntryStaged(ctx.db, entry.id, {
        claimToken: claimTokenOf(ctx),
        sha256: result.sha256,
      });
    } finally {
      source.destroy();
    }
    await ctx.fault('entry:after-stage', entry.relPath);

    return this.staged;
  }
}

/** The existing destination path must be a regular file to be compared with or replaced by a copy. */
const assertPlaceable = (existing: Stats, candidateRel: string): void => {
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
};

/**
 * Nothing is at `abs`: stage, link without clobbering, unlink the staging
 * file, set the modified time, hash the placed file back. Returns the hash,
 * or null when another writer created `abs` first (the caller looks again).
 */
const placeNew = async (
  plan: FilePlan,
  abs: string,
): Promise<string | null> => {
  const { ctx, entry, size, modifiedAt } = plan;
  const { dest } = ctx;
  const { file, sha256 } = await plan.staging.get();

  if (!(await dest.link(file, abs))) return null;
  await ctx.fault('entry:after-link', entry.relPath);
  await dest.unlink(file);
  await ctx.fault('entry:after-unlink', entry.relPath);
  await dest.utimes(abs, modifiedAt);
  await ctx.fault('entry:after-utimes', entry.relPath);

  const written = await dest.hashFile(abs, ctx.signal);

  if (written.sha256 !== sha256 || written.bytes !== size) {
    // Only the file this attempt created.
    await dest.unlink(abs);
    throw new EntryFailure(
      'verify_mismatch',
      'the destination file read back differently from the source stream',
    );
  }
  await ctx.fault('entry:after-verify', entry.relPath);

  return sha256;
};

/**
 * A regular file of the right size is at `abs`: if its content is the
 * source's, it is adopted (a file an earlier attempt placed before it died).
 * Returns its hash, or null when the content differs.
 */
const adoptIfIdentical = async (
  plan: FilePlan,
  abs: string,
  existing: Stats,
): Promise<string | null> => {
  const { ctx, entry, size, modifiedAt, changed } = plan;
  const { dest } = ctx;

  if (existing.size !== size) return null;

  // An earlier attempt's file is recognised by the hash recorded when it was
  // staged, so a half-finished item does not read that file from the source
  // again. That only holds while the source still looks as it did then.
  const recorded = changed ? null : entry.sha256;
  const stagedNow = recorded ? null : await plan.staging.get();
  const expected = recorded ?? stagedNow?.sha256;
  const present = await dest.hashFile(abs, ctx.signal);

  if (present.sha256 !== expected || present.bytes !== size) return null;

  if (stagedNow) await dest.unlink(stagedNow.file);
  // An earlier attempt may have been killed before it set the time.
  if (!sameSecond(existing.mtime, modifiedAt)) {
    await dest.utimes(abs, modifiedAt);
  }

  return present.sha256;
};

/**
 * Puts the file at `candidateRel` if nothing is there, or recognises it if
 * identical content is. Returns its hash, or null when different content is
 * there. A link that loses a race (EEXIST) is looked at again; a race that
 * never ends throws, because keep-both is for different content only.
 */
const placeCandidate = async (
  plan: FilePlan,
  candidateRel: string,
): Promise<string | null> => {
  const { ctx } = plan;
  const abs = destAbs(ctx.dest.baseRoot, ctx.job.sourceDirName, candidateRel);

  for (let tries = 0; tries < LINK_RACE_TRIES; tries++) {
    assertLive(ctx);
    const existing = await ctx.dest.lstat(abs);

    if (!existing) {
      const placed = await placeNew(plan, abs);

      if (placed) return placed;
      continue;
    }

    assertPlaceable(existing, candidateRel);

    return adoptIfIdentical(plan, abs, existing);
  }

  throw new EntryFailure(
    'dest_conflict',
    `${candidateRel} kept changing while it was being placed`,
  );
};

const verified = (
  plan: FilePlan,
  destRelPath: string,
  sha256: string,
  keptBoth: boolean,
): BackupEntryResult => ({
  status: 'verified',
  sizeBytes: plan.size,
  sha256,
  destRelPath,
  // Keep-both is the more consequential of the two notes.
  issueKind: keptBoth ? 'kept_both' : plan.changed ? 'source_changed' : null,
  ...(plan.changed ? { message: plan.changed } : {}),
});

/**
 * One file: stream the source into the staging folder
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
  const plan: FilePlan = {
    ctx,
    entry,
    size: info.size,
    modifiedAt: info.modifiedAt,
    changed: changeSincePreviousRead(entry, info),
    staging: new Staging(ctx, entry, info.size),
  };

  await dest.ensureDir(
    path.dirname(destAbs(dest.baseRoot, job.sourceDirName, rel)),
  );

  const mirrored = await placeCandidate(plan, rel);

  if (mirrored) return verified(plan, rel, mirrored, false);

  const keepBoth = keepBothRel(rel, job.id);
  const renamed = await placeCandidate(plan, keepBoth);

  if (renamed) return verified(plan, keepBoth, renamed, true);

  throw new EntryFailure(
    'dest_conflict',
    `${rel} and its keep-both name both hold different content`,
  );
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
    // An abort (shutdown, lost lease, stalled destination) explains whatever
    // error it caused: it is not a failure of this entry.
    assertLive(ctx);

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
