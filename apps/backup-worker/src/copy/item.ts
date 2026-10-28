import {
  completeBackupItem,
  failBackupItem,
  getBackupEntryCounts,
  listBackupEntries,
  upsertBackupEntries,
  markBackupEnumerationComplete,
} from '@abbottland/homelab-db';
import { ConnectionError } from '@abbottland/source-access';
import { assertLive, claimTokenOf, type CopyContext } from './context';
import { enumerateDirectory } from './enumerate';
import { processEntry } from './entry';
import { SourceUnreachableError } from './errors';
import { classifyFailures } from './finish';
import { destAbs, entryDestRel, entrySourcePath, stagingDir } from './layout';

/** Entries read, described and copied per round; also the `allinfo` batch size. */
const PAGE = 100;
const SAMPLE_FAILED = 200;

/** A file item has exactly one entry, with an empty relative path. */
const prepareFile = async (ctx: CopyContext): Promise<void> => {
  await upsertBackupEntries(ctx.db, ctx.item.id, {
    claimToken: claimTokenOf(ctx),
    entries: [{ relPath: '', normalizedRelPath: '', entryType: 'file' }],
  });
  await markBackupEnumerationComplete(ctx.db, ctx.item.id, {
    claimToken: claimTokenOf(ctx),
  });
};

/**
 * The source could not list the item's root. A missing or forbidden root
 * cannot be fixed by retrying, so it becomes a failed root entry and the item
 * finishes as blocked; a machine that stopped answering is released.
 */
const recordRootListingFailure = async (
  ctx: CopyContext,
  err: ConnectionError,
): Promise<void> => {
  if (err.code === 'unreachable') throw new SourceUnreachableError(err.message);
  if (err.code !== 'not_found' && err.code !== 'auth') throw err;

  await upsertBackupEntries(ctx.db, ctx.item.id, {
    claimToken: claimTokenOf(ctx),
    entries: [
      {
        relPath: '',
        normalizedRelPath: '',
        entryType: 'directory',
        status: 'failed',
        issueKind: err.code === 'not_found' ? 'source_missing' : 'unlistable',
        message: err.message,
      },
    ],
  });
};

/** Copies every pending entry, a page at a time (ids ascend, so paging is stable). */
const processPending = async (ctx: CopyContext): Promise<void> => {
  const { item } = ctx;
  let after = 0;

  for (;;) {
    assertLive(ctx);
    const entries = await listBackupEntries(ctx.db, {
      jobItemId: item.id,
      status: 'pending',
      after,
      limit: PAGE,
    });

    if (entries.length === 0) return;
    after = entries[entries.length - 1].id;

    // Describe the whole page before any of it is read: reading changes the
    // access time on the source, and the original is worth keeping.
    const infos = await ctx.driver.allinfo(
      ctx.target,
      entries.map((entry) => entrySourcePath(item.rootPath, entry.relPath)),
    );

    await ctx.fault('item:after-allinfo');
    for (let i = 0; i < entries.length; i++) {
      await processEntry(ctx, entries[i], infos[i]);
    }
  }
};

/**
 * Writing children changes a directory's modified time, so the source times
 * go on last, deepest directories first.
 */
const applyDirectoryTimes = async (ctx: CopyContext): Promise<void> => {
  const directories: { rel: string; modifiedAt: Date }[] = [];
  let after = 0;

  for (;;) {
    const page = await listBackupEntries(ctx.db, {
      jobItemId: ctx.item.id,
      status: 'verified',
      after,
      limit: 1000,
    });

    if (page.length === 0) break;
    after = page[page.length - 1].id;
    for (const entry of page) {
      if (entry.entryType === 'directory' && entry.srcModifiedAt) {
        directories.push({
          rel: entryDestRel(ctx.item.destRelPath, entry.relPath),
          modifiedAt: entry.srcModifiedAt,
        });
      }
    }
  }

  directories.sort((a, b) => b.rel.split('/').length - a.rel.split('/').length);

  for (const { rel, modifiedAt } of directories) {
    assertLive(ctx);
    await ctx.dest.utimes(
      destAbs(ctx.dest.baseRoot, ctx.job.sourceDirName, rel),
      modifiedAt,
    );
    await ctx.fault('item:after-directory-time', rel);
  }
};

/** §4.2 step 6: verified, or requeued, blocked or failed by what went wrong. */
const finish = async (ctx: CopyContext): Promise<void> => {
  const { db, item } = ctx;
  const counts = await getBackupEntryCounts(db, item.id);

  if (counts.failed === 0) {
    await completeBackupItem(db, item.id, { claimToken: claimTokenOf(ctx) });

    return;
  }

  const failed = await listBackupEntries(db, {
    jobItemId: item.id,
    status: 'failed',
    limit: SAMPLE_FAILED,
  });
  const { kind, error } = classifyFailures(
    failed.map((entry) => ({
      relPath: entry.relPath,
      issueKind: entry.issueKind,
      message: entry.message,
    })),
    counts.failed,
  );

  await failBackupItem(db, item.id, {
    claimToken: claimTokenOf(ctx),
    error,
    kind,
  });
};

/**
 * Copies one claimed item (§4.3). Safe to repeat and to interrupt anywhere:
 * progress lives in `backup_entries`, the destination is only ever added to,
 * and leftovers of a killed attempt (the item's staging folder) are removed
 * first. Resolves once the item is settled (verified, requeued, blocked or
 * failed). Throws `ClaimLostError`, `SourceUnreachableError` or an unexpected
 * error without settling it; the caller decides what the lease does then.
 */
export const processItem = async (ctx: CopyContext): Promise<void> => {
  const { item, dest } = ctx;
  const itemStaging = stagingDir(dest.baseRoot, item.id);

  assertLive(ctx);
  await ctx.preflight();
  await dest.assertBaseSafe();
  await dest.removeItemStaging(itemStaging);
  await ctx.fault('item:start');

  try {
    if (item.kind === 'file') await prepareFile(ctx);
    else await enumerateDirectory(ctx);
  } catch (err) {
    if (!(err instanceof ConnectionError)) throw err;
    await recordRootListingFailure(ctx, err);
    await finish(ctx);

    return;
  }

  await processPending(ctx);
  if (item.kind === 'directory') await applyDirectoryTimes(ctx);

  await dest.removeItemStaging(itemStaging);
  await dest.removeStagingRootIfEmpty();
  await ctx.fault('item:before-finish');
  await finish(ctx);
};
