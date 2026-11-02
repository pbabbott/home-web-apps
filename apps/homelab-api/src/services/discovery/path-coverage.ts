import {
  DiscoveryError,
  findDeepestQueueItemAt,
  findKnownSkipsAt,
  findNestedInventoryItems,
  getSourceById,
  listExclusionRules,
  resolveExclusion,
  type ExclusionResolution,
  type KnownSkip,
  type NestedInventoryItem,
  type VisitedQueueItem,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { matchesNamePattern } from '../../lib/name-pattern';
import { isWithinPath, normalizeWindowsPath } from '@abbottland/source-access';
import { ancestorsOf } from './paths';

/**
 * - `covered`: the nearest decided inventory item at or above the path is approved.
 * - `carved_out`: that item is rejected, inside a farther approved one.
 * - `rejected`: that item is rejected and nothing above approves.
 * - `pending`: inventory items at or above the path exist, none decided.
 * - `uncovered`: no inventory item at or above the path.
 */
export type CoverageStatus =
  | 'covered'
  | 'carved_out'
  | 'rejected'
  | 'pending'
  | 'uncovered';

export type PathCoverage = {
  path: string;
  normalizedPath: string;
  status: CoverageStatus;
  /** The item that decided `status`; the nearest item when pending. */
  decidingItem: NestedInventoryItem | null;
  /** The inventory item at exactly this path. */
  exact: NestedInventoryItem | null;
  /** Inventory items whose root is a proper ancestor, farthest first. */
  coveredBy: NestedInventoryItem[];
  /** Inventory items beneath the path (capped). */
  covers: NestedInventoryItem[];
  exclusion: ExclusionResolution;
  /** The deepest agent skip at or above the path, newest first on a tie. */
  skip: KnownSkip | null;
  /** The deepest queue item at or above the path, in any job. */
  visitedDirectory: VisitedQueueItem | null;
};

/**
 * Resolves the path's standing from the items at or above it. `coveredBy` is
 * farthest first; the nearest decided item wins, and a rejection only counts
 * as a carve-out when something farther up approves.
 */
export const resolveCoverageStatus = (
  exact: NestedInventoryItem | null,
  coveredBy: NestedInventoryItem[],
): { status: CoverageStatus; decidingItem: NestedInventoryItem | null } => {
  const nearestFirst = exact
    ? [exact, ...coveredBy.toReversed()]
    : coveredBy.toReversed();
  const index = nearestFirst.findIndex((item) => item.decision !== 'pending');

  if (index < 0) {
    return nearestFirst.length > 0
      ? { status: 'pending', decidingItem: nearestFirst[0] }
      : { status: 'uncovered', decidingItem: null };
  }

  const decidingItem = nearestFirst[index];

  if (decidingItem.decision === 'approved') {
    return { status: 'covered', decidingItem };
  }

  const approvedAbove = nearestFirst
    .slice(index + 1)
    .some((item) => item.decision === 'approved');

  return { status: approvedAbove ? 'carved_out' : 'rejected', decidingItem };
};

/**
 * The skip that bears on `normalizedPath`, deepest first. A path skip counts at
 * the path or an ancestor; a pattern skip records its directory, and counts
 * when the pattern matches the path's segment directly beneath it.
 */
export const pickBearingSkip = (
  skips: KnownSkip[],
  normalizedPath: string,
): KnownSkip | null => {
  const depthOf = (skip: KnownSkip): number | null => {
    const skipPath = normalizeWindowsPath(skip.path).normalizedPath;

    if (!skip.pattern) {
      return isWithinPath(skipPath, normalizedPath) ? skipPath.length : null;
    }

    if (
      skipPath === normalizedPath ||
      !isWithinPath(skipPath, normalizedPath)
    ) {
      return null;
    }

    const segment = normalizedPath
      .slice(skipPath.replace(/\\+$/, '').length + 1)
      .split('\\')[0];

    return matchesNamePattern(skip.pattern, segment)
      ? skipPath.length + 1 + segment.length
      : null;
  };

  let best: { skip: KnownSkip; depth: number } | null = null;

  for (const skip of skips) {
    const depth = depthOf(skip);

    if (
      depth !== null &&
      (best === null ||
        depth > best.depth ||
        (depth === best.depth && skip.skippedAt > best.skip.skippedAt))
    ) {
      best = { skip, depth };
    }
  }

  return best?.skip ?? null;
};

/** Says whether a path rolls up to an inventory item of the source, and what else bears on it. Read-only. */
export async function checkPathCoverage(
  sourceId: string,
  input: string,
): Promise<PathCoverage> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  const { path, normalizedPath } = normalizeWindowsPath(input);
  const ancestors = ancestorsOf(normalizedPath);
  const atOrAbove = [normalizedPath, ...ancestors];

  const [nested, rules, skips, visited] = await Promise.all([
    findNestedInventoryItems(db, sourceId, normalizedPath, atOrAbove),
    listExclusionRules(db, { sourceId }),
    findKnownSkipsAt(db, sourceId, atOrAbove),
    findDeepestQueueItemAt(db, sourceId, atOrAbove),
  ]);

  const exact =
    nested.coveredBy.find(
      (item) =>
        normalizeWindowsPath(item.rootPath).normalizedPath === normalizedPath,
    ) ?? null;
  const coveredBy = nested.coveredBy.filter((item) => item !== exact);

  return {
    path,
    normalizedPath,
    ...resolveCoverageStatus(exact, coveredBy),
    exact,
    coveredBy,
    covers: nested.covers,
    exclusion: resolveExclusion(rules, normalizedPath),
    skip: pickBearingSkip(skips, normalizedPath),
    visitedDirectory: visited ?? null,
  };
}
