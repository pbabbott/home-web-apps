import {
  markBackupEnumerationComplete,
  upsertBackupEntries,
  type BackupEntryInput,
} from '@abbottland/homelab-db';
import {
  ConnectionError,
  normalizeWindowsPath,
  type TreeEntry,
} from '@abbottland/source-access';
import { assertLive, claimTokenOf, type CopyContext } from './context';
import { entrySourcePath } from './layout';

const BATCH = 500;

/** Lowercased `\`-separated path below the item root, as coverage compares it. */
export const normalizeRelPath = (relPath: string): string =>
  relPath.toLowerCase();

/**
 * True when `relPath` is, or lies under, one of the item's carve-outs (a
 * rejected nested item or an `exclude_subtree` rule): those are never copied.
 */
export const makeCarveOutMatcher = (
  normalizedRootPath: string,
  carveOuts: { path: string }[],
): ((relPath: string) => boolean) => {
  const carved = carveOuts.map(
    (carve) => normalizeWindowsPath(carve.path).normalizedPath,
  );

  return (relPath) => {
    const full = `${normalizedRootPath}\\${relPath.toLowerCase()}`;

    return carved.some((c) => full === c || full.startsWith(`${c}\\`));
  };
};

/**
 * A directory the listing could not enter: a junction or link is not followed
 * (`allinfo` shows the reparse bit), anything else is `unlistable`.
 */
const describeUnlistable = async (
  ctx: CopyContext,
  entry: Extract<TreeEntry, { kind: 'error' }>,
): Promise<BackupEntryInput> => {
  const [info] = await ctx.driver.allinfo(ctx.target, [
    entrySourcePath(ctx.item.rootPath, entry.relPath),
  ]);
  const base = {
    relPath: entry.relPath,
    normalizedRelPath: normalizeRelPath(entry.relPath),
    entryType: 'directory' as const,
  };

  if (!(info instanceof ConnectionError) && info.isReparsePoint) {
    return {
      ...base,
      status: 'not_followed',
      issueKind: 'reparse_point_not_followed',
      message: 'a junction or symbolic link is not followed',
    };
  }

  return {
    ...base,
    status: 'failed',
    issueKind: 'unlistable',
    message: `could not list the directory: ${entry.message}`,
  };
};

/**
 * Lists the item's tree and records every file and directory as a `pending`
 * entry (the root as `''`), in batches, then marks enumeration complete. A
 * retry lists again and upserts: nothing is duplicated, a `verified` entry
 * stays verified, a failed one becomes pending again.
 */
export const enumerateDirectory = async (ctx: CopyContext): Promise<void> => {
  const { item } = ctx;
  const carvedOut = makeCarveOutMatcher(
    item.normalizedRootPath,
    item.carveOuts,
  );
  let batch: BackupEntryInput[] = [
    { relPath: '', normalizedRelPath: '', entryType: 'directory' },
  ];

  const flush = async () => {
    if (batch.length === 0) return;
    await upsertBackupEntries(ctx.db, item.id, {
      claimToken: claimTokenOf(ctx),
      entries: batch,
    });
    batch = [];
    await ctx.fault('item:after-enumeration-batch');
  };

  for await (const entry of ctx.driver.listTree(ctx.target, item.rootPath)) {
    assertLive(ctx);
    if (carvedOut(entry.relPath)) continue;

    batch.push(
      entry.kind === 'entry'
        ? {
            relPath: entry.relPath,
            normalizedRelPath: normalizeRelPath(entry.relPath),
            entryType: entry.isDirectory ? 'directory' : 'file',
            sizeBytes: entry.isDirectory ? null : entry.size,
          }
        : await describeUnlistable(ctx, entry),
    );
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  await markBackupEnumerationComplete(ctx.db, item.id, {
    claimToken: claimTokenOf(ctx),
  });
  await ctx.fault('item:after-enumeration-complete');
};
