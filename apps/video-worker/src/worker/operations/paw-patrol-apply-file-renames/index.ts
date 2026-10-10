import { listPendingFileRenames, type VideoJob } from '@abbottland/video-db';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { NamedStep } from '../pipeline';
import { runSteps } from '../pipeline';
import type { OperationResult } from '../operation-result';
import type { ApplyContext, SkippedRow } from './context';
import { normalizeRelPath } from './lib/paths';
import { isPawPatrolApplyFileRenamesParameters } from './parameters';
import { applyRow } from './resolve';

const summarizeSkips = (skipped: SkippedRow[]): string => {
  const counts = new Map<string, number>();

  for (const skip of skipped) {
    counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ');
};

const listPendingRenames: NamedStep<ApplyContext>['run'] = async (ctx) => {
  const rows = await listPendingFileRenames(db);

  return {
    ...ctx,
    rows,
    pendingByOriginalPath: new Map(
      rows.map((row) => [normalizeRelPath(row.originalFilePath), row]),
    ),
  };
};

/**
 * Applies every pending file_renames row: a plain rename (fs.rename), or a
 * split (ffmpeg cut into two files, original moved to discarded/) — see
 * resolve.ts for the recursive collision-chain resolution this requires.
 * Not scoped by season: file_renames isn't season-scoped, and a collision
 * chain could plausibly span season directories.
 *
 * One row failing (an unresolvable collision, a cycle, a missing/mismatched
 * source, an ffmpeg error) never fails the whole job on its own — it's
 * recorded in ctx.skipped, left `pending` in the DB, and the loop moves on.
 * Every row that does apply is marked so immediately after its filesystem
 * mutation succeeds, not batched at the end, so a mid-run crash leaves a
 * resumable state (already-applied rows stay applied, the rest are picked up
 * next run). If every row errored (e.g. a systemic permission/mount problem),
 * this step throws instead of reporting a misleading "completed" — see below.
 */
const applyRenames: NamedStep<ApplyContext>['run'] = async (ctx) => {
  for (const row of ctx.rows) {
    // already resolved (applied or failed) via another row's chain
    if (
      ctx.appliedHashes.has(row.fileHash) ||
      ctx.failedHashes.has(row.fileHash)
    ) {
      continue;
    }

    try {
      await applyRow(ctx, row, new Set([row.fileHash]));
    } catch (err) {
      console.error(`⚠️  apply failed for ${row.originalFilePath}:`, err);
      ctx.skipped.push({
        fileHash: row.fileHash,
        originalFilePath: row.originalFilePath,
        reason: 'error',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (
    ctx.rows.length > 0 &&
    ctx.appliedHashes.size === 0 &&
    ctx.skipped.length > 0 &&
    ctx.skipped.every((skip) => skip.reason === 'error')
  ) {
    throw new JobProcessingError(
      `all ${ctx.skipped.length} row(s) errored, 0 applied: ${summarizeSkips(ctx.skipped)}`,
    );
  }

  return ctx;
};

const steps: NamedStep<ApplyContext>[] = [
  {
    name: 'list-pending-renames',
    message: 'Listing pending renames',
    run: listPendingRenames,
  },
  {
    name: 'apply-renames',
    message: 'Applying renames',
    run: applyRenames,
  },
];

export const runPawPatrolApplyFileRenamesOperation = async (
  job: VideoJob,
): Promise<OperationResult> => {
  if (!isPawPatrolApplyFileRenamesParameters(job.parameters)) {
    throw new JobProcessingError('parameters must be an object');
  }

  const ctx: ApplyContext = {
    job,
    rows: [],
    pendingByOriginalPath: new Map(),
    appliedHashes: new Set(),
    failedHashes: new Map(),
    skipped: [],
  };

  const result = await runSteps(ctx, steps);

  const applied = result.appliedHashes.size;
  const skipSummary = result.skipped.length
    ? ` (${summarizeSkips(result.skipped)})`
    : '';

  return {
    message: `applied ${applied} rename(s), skipped ${result.skipped.length}${skipSummary}`,
  };
};
