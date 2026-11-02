import type { BadgeColor, CardColor } from '@abbottland/fui-components';
import type {
  CoverageStatus,
  PathCoverage,
  InventoryItemDecision,
  InventoryItemGitEvidence,
  InventoryItemKind,
  InventoryItemRecommendation,
  InventoryItem,
} from '../sources/lib/homelab-api';

export const RECOMMENDATION_LABELS: Record<
  InventoryItemRecommendation,
  string
> = {
  back_up: 'Back up',
  skip: 'Skip',
  needs_review: 'Needs review',
};

export const RECOMMENDATION_COLOR: Record<
  InventoryItemRecommendation,
  BadgeColor
> = {
  back_up: 'success',
  skip: 'dark',
  needs_review: 'warning',
};

export const DECISION_LABELS: Record<InventoryItemDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const DECISION_COLOR: Record<InventoryItemDecision, BadgeColor> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  covered: 'Covered',
  carved_out: 'Carved out',
  rejected: 'Rejected',
  pending: 'Pending review',
  uncovered: 'Not covered',
};

export const COVERAGE_STATUS_DESCRIPTIONS: Record<CoverageStatus, string> = {
  covered: 'An approved inventory item at or above this path covers it.',
  carved_out:
    'Rejected: an inventory item here is rejected, inside an approved one.',
  rejected: 'The nearest decided inventory item at or above it is rejected.',
  pending:
    'Inventory items at or above this path exist, but none is decided yet.',
  uncovered: 'No inventory item at or above this path.',
};

export const COVERAGE_STATUS_COLOR: Record<CoverageStatus, BadgeColor> = {
  covered: 'success',
  carved_out: 'error',
  rejected: 'error',
  pending: 'warning',
  uncovered: 'dark',
};

/** Card colors follow the human decision: pending work stands out, decided work reads as done. */
export const DECISION_CARD_COLOR: Record<InventoryItemDecision, CardColor> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

/** What the decision filter shows: the three decisions, or everything. */
export type DecisionFilter = InventoryItemDecision | 'all';

/** A decision filter from a URL parameter. Absent or unknown means the review queue: pending. */
export function parseDecisionFilter(value: string | undefined): DecisionFilter {
  return value === 'approved' ||
    value === 'rejected' ||
    value === 'all' ||
    value === 'pending'
    ? value
    : 'pending';
}

/** A recommendation filter from a URL parameter; anything else means "all". */
export function parseRecommendation(
  value: string | undefined,
): InventoryItemRecommendation | undefined {
  return value === 'back_up' || value === 'skip' || value === 'needs_review'
    ? value
    : undefined;
}

/** What the kind filter shows: files, folders, or both (undefined). */
export function parseKind(
  value: string | undefined,
): InventoryItemKind | undefined {
  return value === 'file' || value === 'directory' ? value : undefined;
}

/** A 1-based page number from a URL parameter. Absent or invalid means the first page. */
export function parsePage(value: string | undefined): number {
  const page = Number(value);

  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * True when the agent changed its recommendation after a human decided, so the
 * decision may deserve another look. A pending inventory item has nothing to revisit.
 */
export function changedSinceDecision(
  inventoryItem: Pick<
    InventoryItem,
    'decision' | 'decidedAt' | 'recommendedAt'
  >,
): boolean {
  return (
    inventoryItem.decision !== 'pending' &&
    inventoryItem.decidedAt !== null &&
    Date.parse(inventoryItem.recommendedAt) >
      Date.parse(inventoryItem.decidedAt)
  );
}

const flag = (label: string, value: boolean | null): string =>
  `${label}: ${value === null ? 'unknown' : value ? 'yes' : 'no'}`;

/** One short line per git fact, so unknowns are visible rather than implied. */
export function describeGit(git: InventoryItemGitEvidence): string[] {
  return [
    `Remote: ${git.remoteUrl ?? 'none'} (${git.remoteVisibility})`,
    `Local state checked: ${git.localStateKnown ? 'yes' : 'no'}`,
    flag('Uncommitted changes', git.uncommittedChanges),
    flag('Untracked files', git.untrackedFiles),
    flag('Unpushed commits', git.unpushedCommits),
    flag('Notable ignored files', git.ignoredFilesOfNote),
  ];
}

export interface InventoryItemView {
  /** Source whose inventory items are shown. */
  source?: string;
  /** Defaults to pending, so it is omitted from the URL. */
  decision?: DecisionFilter;
  recommendation?: InventoryItemRecommendation;
  kind?: InventoryItemKind;
  /** Search text, matched by the server against path, name and summary. */
  q?: string;
  /** Exactly one inventory item, by its root path. */
  path?: string;
  /** 1-based; the first page is the default, so it is omitted from the URL. */
  page?: number;
}

const INVENTORY_ITEMS_PATH = '/exodus/inventory';

/** Page URL for a view; defaults are left out so URLs stay short and shareable. */
export function inventoryItemsUrl(view: InventoryItemView): string {
  const params = new URLSearchParams();

  if (view.source) params.set('source', view.source);
  if (view.decision && view.decision !== 'pending') {
    params.set('decision', view.decision);
  }
  if (view.recommendation) params.set('recommendation', view.recommendation);
  if (view.kind) params.set('kind', view.kind);
  if (view.q) params.set('q', view.q);
  if (view.path) params.set('path', view.path);
  if (view.page && view.page > 1) params.set('page', String(view.page));

  const query = params.toString();

  return query ? `${INVENTORY_ITEMS_PATH}?${query}` : INVENTORY_ITEMS_PATH;
}

/**
 * Link to one inventory item. Every decision is included, because the item may
 * be approved or rejected and the default view only lists pending ones.
 */
export function inventoryItemUrl(sourceId: string, rootPath: string): string {
  return inventoryItemsUrl({
    source: sourceId,
    decision: 'all',
    path: rootPath,
  });
}

/** True when the view narrows the list beyond the default review queue. */
export function hasActiveFilters(
  view: Pick<
    InventoryItemView,
    'decision' | 'recommendation' | 'kind' | 'q' | 'path'
  >,
): boolean {
  return Boolean(
    (view.decision && view.decision !== 'pending') ||
      view.recommendation ||
      view.kind ||
      view.q ||
      view.path,
  );
}

/**
 * Page numbers to show: the first, the last and a window around the current
 * page, with `'gap'` where numbers are left out.
 */
export function pageNumbers(
  current: number,
  totalPages: number,
): (number | 'gap')[] {
  const wanted = new Set(
    [1, totalPages, current - 1, current, current + 1].filter(
      (n) => n >= 1 && n <= totalPages,
    ),
  );
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];

  sorted.forEach((n, i) => {
    const previous = sorted[i - 1];

    if (previous !== undefined && n - previous === 2) result.push(previous + 1);
    else if (previous !== undefined && n - previous > 2) result.push('gap');
    result.push(n);
  });

  return result;
}

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

/**
 * Whether a checked path can be promoted from the directory a job visited:
 * nothing already sits at the path, no rule excludes it, nothing above
 * approves it (or carves it out), and the visited directory is strictly above.
 */
export function canPromoteCheckedPath(coverage: PathCoverage): boolean {
  const visited = coverage.visitedDirectory;

  if (!visited || coverage.exact) return false;
  if (coverage.exclusion.state === 'excluded') return false;
  if (coverage.status === 'covered' || coverage.status === 'carved_out') {
    return false;
  }

  const dir = visited.path.toLowerCase().replace(/\\+$/, '');

  return coverage.normalizedPath.startsWith(`${dir}\\`);
}
