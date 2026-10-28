import type {
  DiscoveryQueueItemStatus,
  InventoryCoverage,
  QueueItemResult,
} from '@abbottland/homelab-db';
import { normalizeWindowsPath, type DirEntry } from '@abbottland/source-access';
import { matchesNamePattern } from '../../lib/name-pattern';
import type { SkipReview } from './skip-review';

/** How something on disk is accounted for, so a reviewer can find what is not. */
export type Coverage =
  | {
      kind: 'inventory';
      decision: InventoryCoverage['decision'];
      recommendation: InventoryCoverage['recommendation'];
    }
  /** An inventory item at the directory itself or above covers it. */
  | { kind: 'inventory_parent' }
  | {
      kind: 'skipped';
      via: 'path' | 'pattern';
      pattern?: string;
      acknowledged: boolean;
    }
  /** The job gave it a queue item of its own, which accounts for it. */
  | { kind: 'queued'; status: DiscoveryQueueItemStatus }
  | { kind: 'excluded' }
  /** A directory with inventory items deeper down but none of its own. */
  | { kind: 'inventory_inside'; count: number }
  | { kind: 'uncovered' };

export type DiskEntry = DirEntry & { path: string; coverage: Coverage };

export type CoverageInputs = {
  /** The queue item's directory. */
  directory: string;
  entries: DirEntry[];
  /** Every inventory item of the source at or beneath the directory. */
  inventoryUnder: InventoryCoverage[];
  /** An inventory item at the directory itself or above it exists. */
  coveredByInventoryParent: boolean;
  /** The job's queue items at the entries' paths, keyed by normalized path. */
  queueStatuses: ReadonlyMap<string, DiscoveryQueueItemStatus>;
  /** Whether an exclusion rule excludes this normalized path. */
  isExcluded: (normalizedPath: string) => boolean;
  result: QueueItemResult | null;
  skipReview: SkipReview;
};

/** `directory\name`, built by string so an odd name cannot throw. */
export const childOf = (
  directory: string,
  name: string,
): { path: string; normalizedPath: string } => {
  const base = normalizeWindowsPath(directory).path.replace(/\\+$/, '');
  const path = `${base}\\${name}`;

  return { path, normalizedPath: path.toLowerCase() };
};

/**
 * Says how each direct entry of a directory is accounted for. Precedence:
 * inventory item, inventory parent, skip (by path, then pattern), queue item
 * of its own, exclusion rule, inventory deeper down, else not covered.
 */
export function classifyEntries(inputs: CoverageInputs): {
  entries: DiskEntry[];
  uncovered: number;
} {
  const { directory, result, skipReview } = inputs;
  const dirPrefix = `${normalizeWindowsPath(directory).normalizedPath.replace(/\\+$/, '')}\\`;

  const exact = new Map<string, InventoryCoverage>();
  const inside = new Map<string, number>();

  for (const item of inputs.inventoryUnder) {
    if (!item.normalizedRootPath.startsWith(dirPrefix)) continue;

    const [first, ...rest] = item.normalizedRootPath
      .slice(dirPrefix.length)
      .split('\\');
    const key = `${dirPrefix}${first}`;

    if (rest.length === 0) exact.set(key, item);
    else inside.set(key, (inside.get(key) ?? 0) + 1);
  }

  const skippedPaths = new Map<string, boolean>();

  (result?.skipped ?? []).forEach((skip, i) => {
    const review = skipReview.paths[i];

    skippedPaths.set(
      normalizeWindowsPath(skip.path).normalizedPath,
      Boolean(review?.acknowledged),
    );
  });

  const classify = (entry: DirEntry, normalizedPath: string): Coverage => {
    const item = exact.get(normalizedPath);

    if (item) {
      return {
        kind: 'inventory',
        decision: item.decision,
        recommendation: item.recommendation,
      };
    }

    if (inputs.coveredByInventoryParent) return { kind: 'inventory_parent' };

    const skipAcknowledged = skippedPaths.get(normalizedPath);

    if (skipAcknowledged !== undefined) {
      return { kind: 'skipped', via: 'path', acknowledged: skipAcknowledged };
    }

    const groups = result?.skippedGroups ?? [];
    const groupIndex = groups.findIndex((group) =>
      matchesNamePattern(group.pattern, entry.name),
    );

    if (groupIndex >= 0) {
      return {
        kind: 'skipped',
        via: 'pattern',
        pattern: groups[groupIndex].pattern,
        acknowledged: Boolean(skipReview.patterns[groupIndex]?.acknowledged),
      };
    }

    const status = inputs.queueStatuses.get(normalizedPath);

    if (status) return { kind: 'queued', status };

    if (inputs.isExcluded(normalizedPath)) return { kind: 'excluded' };

    const count = inside.get(normalizedPath);

    if (count) return { kind: 'inventory_inside', count };

    return { kind: 'uncovered' };
  };

  const entries = inputs.entries.map((entry): DiskEntry => {
    const { path, normalizedPath } = childOf(directory, entry.name);

    return { ...entry, path, coverage: classify(entry, normalizedPath) };
  });

  return {
    entries,
    uncovered: entries.filter((e) => e.coverage.kind === 'uncovered').length,
  };
}
