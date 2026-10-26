import type { QueueItemResult } from '@abbottland/homelab-db';
import { normalizeWindowsPath } from '../../lib/windows-path';

/** What a human has done about the skips beneath a path. */
export type ReviewContext = {
  /** Normalized paths of inventory items, whatever their decision. */
  inventoried: ReadonlySet<string>;
  /** `normalizedPath|pattern` of acknowledged skips; the pattern is empty for a path skip. */
  acknowledged: ReadonlySet<string>;
};

export type SkipReview = {
  /** Null when the directory has no result yet, so nothing can be said. */
  reviewed: boolean | null;
  /** One entry per `result.skipped`, in order. */
  paths: { path: string; acknowledged: boolean; inventoried: boolean }[];
  /** One entry per `result.skippedGroups`, in order. */
  patterns: { pattern: string; acknowledged: boolean }[];
};

const ackKey = (normalizedPath: string, pattern = '') =>
  `${normalizedPath}|${pattern}`;

/**
 * Whether a directory is fully dealt with: every skip reviewed and no
 * inventory item it proposed still waiting for a human decision. Null while
 * the review itself is unknown (no result yet).
 */
export function directoryReviewed(
  skipReview: SkipReview,
  pendingInventory: number,
): boolean | null {
  if (skipReview.reviewed === null) return null;

  return skipReview.reviewed && pendingInventory === 0;
}

/**
 * Whether every skip of a directory has been dealt with. A skipped path counts
 * when acknowledged or promoted to the inventory (the human acted on it); a
 * skipped pattern counts when acknowledged.
 */
export function reviewSkips(
  directory: string,
  result: QueueItemResult | null,
  { acknowledged, inventoried }: ReviewContext,
): SkipReview {
  if (!result) return { reviewed: null, paths: [], patterns: [] };

  const paths = result.skipped.map((skip) => {
    const { normalizedPath } = normalizeWindowsPath(skip.path);

    return {
      path: skip.path,
      acknowledged: acknowledged.has(ackKey(normalizedPath)),
      inventoried: inventoried.has(normalizedPath),
    };
  });
  const directoryKey = normalizeWindowsPath(directory).normalizedPath;
  const patterns = (result.skippedGroups ?? []).map((group) => ({
    pattern: group.pattern,
    acknowledged: acknowledged.has(ackKey(directoryKey, group.pattern)),
  }));

  return {
    reviewed:
      paths.every((p) => p.acknowledged || p.inventoried) &&
      patterns.every((p) => p.acknowledged),
    paths,
    patterns,
  };
}
