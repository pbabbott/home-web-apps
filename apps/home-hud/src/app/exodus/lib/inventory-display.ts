import type { BadgeColor, CardColor } from '@abbottland/fui-components';
import type {
  InventoryItemDecision,
  InventoryItemGitEvidence,
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

/** How the inventory items are laid out: a dense table or roomy cards. */
export type InventoryLayout = 'table' | 'cards';

/** A layout from a URL parameter. Absent or unknown means the table. */
export function parseLayout(value: string | undefined): InventoryLayout {
  return value === 'cards' ? 'cards' : 'table';
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
  /** Defaults to the table, so it is omitted from the URL. */
  layout?: InventoryLayout;
  /** Keyset cursor from the previous page. */
  after?: string;
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
  if (view.layout && view.layout !== 'table') params.set('view', view.layout);
  if (view.after) params.set('after', view.after);

  const query = params.toString();

  return query ? `${INVENTORY_ITEMS_PATH}?${query}` : INVENTORY_ITEMS_PATH;
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
