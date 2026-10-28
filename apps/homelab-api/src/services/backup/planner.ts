import type {
  BackupCarveOut,
  BackupJobSelection,
  BackupPlanningInventoryItem,
  PlannedBackupItem,
} from '@abbottland/homelab-db';
import { isWithinPath, normalizeWindowsPath } from '@abbottland/source-access';
import { ancestorsOf } from '../discovery/paths';
import { toDestRelPath } from './dest-paths';

// The planning rules of docs/exodus/backup-design/plan.md §4.1 as a pure
// function: no database, no clock, so every case is a unit test.

export type PlanRule = {
  id: string;
  scope: 'selective_only' | 'exclude_subtree';
  path: string;
  normalizedPath: string;
};

export type PlanInput = {
  selection: BackupJobSelection;
  inventory: BackupPlanningInventoryItem[];
  /** Rules that apply to the source (its own plus global). */
  rules: PlanRule[];
  /** Inventory items already covered at the destination. */
  coveredIds: ReadonlySet<string>;
  /** Destination paths of items that have a verified copy at the destination. */
  priorDestRelPaths: ReadonlyMap<string, string>;
};

export type NotEligibleItem = {
  inventoryItemId: string;
  rootPath: string;
  decision: BackupPlanningInventoryItem['decision'];
  reason: string;
};

/** A planned job item plus what a person needs to read the plan. */
export type PlanItem = PlannedBackupItem & {
  /** Set for `skipped`/`redundant_nested`: the root path of the covering item. */
  coveredByRootPath?: string;
};

export type PlanResult = {
  items: PlanItem[];
  notEligible: NotEligibleItem[];
};

const matchesSelection = (
  item: BackupPlanningInventoryItem,
  selection: BackupJobSelection,
  ids: ReadonlySet<string> | null,
  prefix: string | null,
): boolean =>
  (ids === null || ids.has(item.id)) &&
  (prefix === null || isWithinPath(prefix, item.normalizedRootPath)) &&
  (!selection.kinds?.length || selection.kinds.includes(item.kind));

/** Code-unit order, so an ancestor always sorts before what is inside it. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const notEligibleReason = (decision: string) =>
  decision === 'rejected'
    ? 'rejected: final, not backed up'
    : 'undecided: approve or reject it first';

/**
 * Plans a job. Items are visited in path order so a directory is decided
 * before anything inside it:
 *
 * 1. not approved -> `notEligible`, not part of the job;
 * 2. under an `exclude_subtree` rule -> `excluded`;
 * 3. inside an approved directory that this job copies, with no rejected
 *    item in between -> `skipped` (`redundant_nested`), covered by it;
 * 4. already covered at the destination -> `skipped` (`already_covered`);
 * 5. otherwise `queued`, with carve-outs for a directory.
 *
 * A directory the job does not copy (already covered, excluded) does not
 * cover what is inside it: the nested item is planned on its own, where
 * adoption of identical files makes a repeat copy harmless.
 */
export const planBackup = ({
  selection,
  inventory,
  rules,
  coveredIds,
  priorDestRelPaths,
}: PlanInput): PlanResult => {
  const ids = selection.inventoryItemIds?.length
    ? new Set(selection.inventoryItemIds)
    : null;
  const prefix = selection.pathPrefix
    ? normalizeWindowsPath(selection.pathPrefix).normalizedPath
    : null;
  const skipCovered = selection.skipAlreadyCovered ?? true;

  const selected = inventory.filter((item) =>
    matchesSelection(item, selection, ids, prefix),
  );
  const notEligible = selected
    .filter((item) => item.decision !== 'approved')
    .map((item) => ({
      inventoryItemId: item.id,
      rootPath: item.rootPath,
      decision: item.decision,
      reason: notEligibleReason(item.decision),
    }));

  const exclusionRules = rules.filter((r) => r.scope === 'exclude_subtree');
  const rejected = inventory.filter((item) => item.decision === 'rejected');
  const isExcluded = (path: string) =>
    exclusionRules.some((r) => isWithinPath(r.normalizedPath, path));

  const byPath = new Map<string, PlanItem>();
  const items: PlanItem[] = [];
  const candidates = selected
    .filter((item) => item.decision === 'approved')
    .sort((a, b) => compare(a.normalizedRootPath, b.normalizedRootPath));

  for (const item of candidates) {
    const base = {
      inventoryItemId: item.id,
      kind: item.kind,
      rootPath: item.rootPath,
      normalizedRootPath: item.normalizedRootPath,
      destRelPath:
        priorDestRelPaths.get(item.id) ?? toDestRelPath(item.rootPath),
      estimatedSizeBytes: item.estimatedSizeBytes,
    };

    let planned: PlanItem;
    const cover = ancestorsOf(item.normalizedRootPath)
      .map((path) => byPath.get(path))
      .find(
        (a) =>
          a?.status === 'queued' &&
          a.kind === 'directory' &&
          !rejected.some(
            (r) =>
              r.normalizedRootPath !== a.normalizedRootPath &&
              isWithinPath(a.normalizedRootPath, r.normalizedRootPath) &&
              isWithinPath(r.normalizedRootPath, item.normalizedRootPath),
          ),
      );

    if (isExcluded(item.normalizedRootPath)) {
      planned = {
        ...base,
        status: 'excluded',
        statusReason: 'excluded_by_rule',
      };
    } else if (cover) {
      planned = {
        ...base,
        status: 'skipped',
        statusReason: 'redundant_nested',
        coveredByInventoryItemId: cover.inventoryItemId,
        coveredByRootPath: cover.rootPath,
      };
    } else if (skipCovered && coveredIds.has(item.id)) {
      planned = { ...base, status: 'skipped', statusReason: 'already_covered' };
    } else {
      planned = {
        ...base,
        status: 'queued',
        ...(item.kind === 'directory'
          ? {
              carveOuts: carveOutsFor(
                item.normalizedRootPath,
                rejected,
                exclusionRules,
              ),
            }
          : {}),
      };
    }

    byPath.set(item.normalizedRootPath, planned);
    items.push(planned);
  }

  return { items, notEligible };
};

/**
 * What a directory item must leave out: rejected inventory items inside it
 * and `exclude_subtree` rules inside it (the nearest decided item wins). A
 * carve-out nested in another carve-out is dropped as redundant.
 */
const carveOutsFor = (
  root: string,
  rejected: BackupPlanningInventoryItem[],
  exclusionRules: PlanRule[],
): BackupCarveOut[] => {
  const all = [
    ...rejected
      .filter(
        (r) =>
          r.normalizedRootPath !== root &&
          isWithinPath(root, r.normalizedRootPath),
      )
      .map((r) => ({
        normalized: r.normalizedRootPath,
        carve: {
          path: r.rootPath,
          reason: 'rejected_item' as const,
          refId: r.id,
        },
      })),
    ...exclusionRules
      .filter(
        (r) =>
          r.normalizedPath !== root && isWithinPath(root, r.normalizedPath),
      )
      .map((r) => ({
        normalized: r.normalizedPath,
        carve: {
          path: r.path,
          reason: 'exclusion_rule' as const,
          refId: r.id,
        },
      })),
  ].sort((a, b) => compare(a.normalized, b.normalized));

  const kept: typeof all = [];
  for (const entry of all) {
    if (!kept.some((k) => isWithinPath(k.normalized, entry.normalized))) {
      kept.push(entry);
    }
  }

  return kept.map((k) => k.carve);
};
