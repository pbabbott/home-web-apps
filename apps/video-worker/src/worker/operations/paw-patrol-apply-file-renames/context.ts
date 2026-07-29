import type { FileRename, VideoJob } from '@abbottland/video-db';

export type SkipReason =
  | 'untracked-collision'
  | 'cycle'
  | 'source-missing'
  | 'hash-mismatch'
  | 'split-output-missing'
  | 'error';

export type SkippedRow = {
  fileHash: string;
  originalFilePath: string;
  reason: SkipReason;
  detail?: string;
};

export type ApplyContext = {
  job: VideoJob;
  /**
   * Pending rows keyed by normalizeRelPath(originalFilePath) — answers "is
   * the file currently occupying this target path itself a pending row
   * that wants to move away?". Built once from listPendingFileRenames.
   * A row is deleted from here the instant it's applied: fs.existsSync is
   * the real source of truth for whether a path is free, but leaving a
   * stale entry here would let a later lookup mistake an already-vacated
   * path for one still blocked by this row.
   */
  pendingByOriginalPath: Map<string, FileRename>;
  /** fileHashes applied so far this run — the main loop's skip-if-already-done check and applyRow's idempotency guard. */
  appliedHashes: Set<string>;
  /**
   * Reasons already-failed rows failed for, this run. Without this, a row
   * that fails (untracked collision, cycle, etc.) gets fully re-attempted
   * every time it's encountered again — as the main loop's next entry, or
   * as a blocker in some other row's chain — producing duplicate skip
   * records and redundant hashFile/fs calls for a result that can't have
   * changed (nothing was mutated for a failed row).
   */
  failedHashes: Map<string, SkipReason>;
  skipped: SkippedRow[];
  /** MEDIA_ROOT-relative paths written this run, for the job's OperationResult. */
  outputPaths: string[];
};
