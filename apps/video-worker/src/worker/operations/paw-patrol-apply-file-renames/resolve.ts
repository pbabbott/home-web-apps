import fs from 'fs';
import path from 'path';
import {
  hashFile,
  updateFileRenameStatus,
  type FileRename,
} from '@abbottland/video-db';
import { db } from '../../../db';
import { moveToDiscarded } from './lib/discard';
import { normalizeRelPath, resolveMediaPath } from './lib/paths';
import { resolveCutPoint, runSplit } from './lib/split-file';
import type { ApplyContext, SkipReason } from './context';

// A string-literal discriminant (not a boolean one) — this app's tsconfig
// doesn't enable `strict`/`strictNullChecks` (unlike the library packages),
// and TS's control-flow narrowing on a `{ free: true } | { free: false }`
// shaped union doesn't reliably narrow without it. `status` mirrors
// VerifyResult below, which narrows fine under the same config.
type FreeResult =
  | { status: 'free' }
  | { status: 'blocked'; reason: SkipReason };
type ApplyOutcome = 'applied' | SkipReason;

type VerifyResult =
  | { status: 'ok' }
  | { status: 'already-applied' }
  | { status: 'skip'; reason: SkipReason; detail?: string };

const nonEmptyExists = (absPath: string): boolean =>
  fs.existsSync(absPath) && fs.statSync(absPath).size > 0;

const pushSkip = (
  ctx: ApplyContext,
  row: FileRename,
  reason: SkipReason,
  detail?: string,
): void => {
  ctx.skipped.push({
    fileHash: row.fileHash,
    originalFilePath: row.originalFilePath,
    reason,
    detail,
  });
  ctx.failedHashes.set(row.fileHash, reason);
};

/**
 * Persists a row as applied and updates the in-run state that later
 * lookups depend on: pendingByOriginalPath must no longer point a
 * collision walk at this row (its original path is now vacated), and
 * appliedHashes short-circuits the main loop and any recursive re-entry.
 */
const markApplied = async (
  ctx: ApplyContext,
  row: FileRename,
  extraOutputPath?: string,
): Promise<void> => {
  await updateFileRenameStatus(db, row.id, 'applied');

  ctx.appliedHashes.add(row.fileHash);
  ctx.pendingByOriginalPath.delete(normalizeRelPath(row.originalFilePath));
  ctx.outputPaths.push(row.suggestedFilePath);
  if (row.secondSuggestedFilePath) {
    ctx.outputPaths.push(row.secondSuggestedFilePath);
  }
  if (extraOutputPath) {
    ctx.outputPaths.push(extraOutputPath);
  }
};

/**
 * Idempotency + safety gate, run before any mutation for a row:
 * - source exists: re-hash it and confirm it's still the file we think it
 *   is before touching anything (skip on mismatch rather than risk acting
 *   on the wrong file).
 * - source missing: check whether this row was already applied by a run
 *   that crashed after the filesystem mutation but before the DB write —
 *   if the destination(s) already look correct, reconcile the DB and treat
 *   as done rather than re-erroring forever.
 */
const verifySource = async (
  ctx: ApplyContext,
  row: FileRename,
  originalAbsPath: string,
): Promise<VerifyResult> => {
  if (fs.existsSync(originalAbsPath)) {
    const actualHash = await hashFile(originalAbsPath);

    if (actualHash !== row.fileHash) {
      return {
        status: 'skip',
        reason: 'hash-mismatch',
        detail: `expected ${row.fileHash}, found ${actualHash}`,
      };
    }

    return { status: 'ok' };
  }

  if (row.secondSuggestedFilePath) {
    const abs1 = resolveMediaPath(row.suggestedFilePath);
    const abs2 = resolveMediaPath(row.secondSuggestedFilePath);

    if (nonEmptyExists(abs1) && nonEmptyExists(abs2)) {
      await markApplied(ctx, row);
      return { status: 'already-applied' };
    }
  } else {
    const suggestedAbsPath = resolveMediaPath(row.suggestedFilePath);

    if (fs.existsSync(suggestedAbsPath)) {
      const actualHash = await hashFile(suggestedAbsPath);

      if (actualHash === row.fileHash) {
        await markApplied(ctx, row);
        return { status: 'already-applied' };
      }
    }
  }

  return { status: 'skip', reason: 'source-missing' };
};

/**
 * Guarantees `targetRelPath` has nothing on disk, recursively applying
 * whatever pending row currently occupies it first. The recursive call is
 * what gives this the LIFO behavior the collision chain needs: the
 * innermost/final blocker in a chain resolves (and its `await` returns)
 * before the row that depended on it proceeds.
 */
const ensurePathFree = async (
  ctx: ApplyContext,
  targetRelPath: string,
  visiting: Set<string>,
): Promise<FreeResult> => {
  const targetAbsPath = resolveMediaPath(targetRelPath);

  if (!fs.existsSync(targetAbsPath)) {
    return { status: 'free' };
  }

  const blocker = ctx.pendingByOriginalPath.get(
    normalizeRelPath(targetRelPath),
  );

  if (!blocker) {
    return { status: 'blocked', reason: 'untracked-collision' };
  }

  if (visiting.has(blocker.fileHash)) {
    return { status: 'blocked', reason: 'cycle' };
  }

  visiting.add(blocker.fileHash);

  const outcome = await applyRow(ctx, blocker, visiting);

  return outcome === 'applied'
    ? { status: 'free' }
    : { status: 'blocked', reason: outcome };
};

const applyPlainRename = async (
  ctx: ApplyContext,
  row: FileRename,
  originalAbsPath: string,
  visiting: Set<string>,
): Promise<ApplyOutcome> => {
  const free = await ensurePathFree(ctx, row.suggestedFilePath, visiting);

  if (free.status === 'blocked') {
    pushSkip(ctx, row, free.reason);
    return free.reason;
  }

  const suggestedAbsPath = resolveMediaPath(row.suggestedFilePath);

  fs.mkdirSync(path.dirname(suggestedAbsPath), { recursive: true });
  fs.renameSync(originalAbsPath, suggestedAbsPath);
  await markApplied(ctx, row);

  return 'applied';
};

/**
 * A split has two independent destinations, each with its own potential
 * collision sub-chain — both must be freed before anything is written.
 * Nothing is mutated (no ffmpeg call, no discard move) until both targets
 * are confirmed free and both outputs are confirmed written.
 */
const applySplit = async (
  ctx: ApplyContext,
  row: FileRename,
  originalAbsPath: string,
  visiting: Set<string>,
): Promise<ApplyOutcome> => {
  const secondSuggestedFilePath = row.secondSuggestedFilePath;

  if (secondSuggestedFilePath === null || row.splitAtSeconds === null) {
    pushSkip(ctx, row, 'split-output-missing', 'row is missing split fields');
    return 'split-output-missing';
  }

  const free1 = await ensurePathFree(ctx, row.suggestedFilePath, visiting);
  if (free1.status === 'blocked') {
    pushSkip(ctx, row, free1.reason);
    return free1.reason;
  }

  const free2 = await ensurePathFree(ctx, secondSuggestedFilePath, visiting);
  if (free2.status === 'blocked') {
    pushSkip(ctx, row, free2.reason);
    return free2.reason;
  }

  const cutSeconds = await resolveCutPoint(originalAbsPath, row.splitAtSeconds);

  if (cutSeconds === null) {
    pushSkip(
      ctx,
      row,
      'split-output-missing',
      'no keyframe found near split point',
    );
    return 'split-output-missing';
  }

  const abs1 = resolveMediaPath(row.suggestedFilePath);
  const abs2 = resolveMediaPath(secondSuggestedFilePath);

  fs.mkdirSync(path.dirname(abs1), { recursive: true });
  fs.mkdirSync(path.dirname(abs2), { recursive: true });
  await runSplit(originalAbsPath, abs1, abs2, cutSeconds);

  if (!nonEmptyExists(abs1) || !nonEmptyExists(abs2)) {
    pushSkip(
      ctx,
      row,
      'split-output-missing',
      'ffmpeg did not produce both outputs',
    );
    return 'split-output-missing';
  }

  const discardedPath = moveToDiscarded(row.originalFilePath, originalAbsPath);
  await markApplied(ctx, row, discardedPath);

  return 'applied';
};

/**
 * Applies one row — a plain rename or a split — freeing its destination(s)
 * first via ensurePathFree. Returns 'applied', or the SkipReason it
 * couldn't proceed for (recorded in ctx.skipped by whichever of
 * applyPlainRename/applySplit/verifySource detected it).
 */
export const applyRow = async (
  ctx: ApplyContext,
  row: FileRename,
  visiting: Set<string>,
): Promise<ApplyOutcome> => {
  if (ctx.appliedHashes.has(row.fileHash)) {
    return 'applied';
  }

  const cachedFailure = ctx.failedHashes.get(row.fileHash);
  if (cachedFailure) {
    return cachedFailure;
  }

  const originalAbsPath = resolveMediaPath(row.originalFilePath);
  const gate = await verifySource(ctx, row, originalAbsPath);

  if (gate.status === 'already-applied') {
    return 'applied';
  }

  if (gate.status === 'skip') {
    pushSkip(ctx, row, gate.reason, gate.detail);
    return gate.reason;
  }

  return row.secondSuggestedFilePath
    ? applySplit(ctx, row, originalAbsPath, visiting)
    : applyPlainRename(ctx, row, originalAbsPath, visiting);
};
