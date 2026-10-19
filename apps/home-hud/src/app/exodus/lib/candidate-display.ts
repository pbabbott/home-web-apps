import type { BadgeColor } from '@abbottland/fui-components';
import type {
  CandidateDecision,
  CandidateGitEvidence,
  CandidateRecommendation,
  ReviewCandidate,
} from '../sources/lib/homelab-api';

export const RECOMMENDATION_LABELS: Record<CandidateRecommendation, string> = {
  back_up: 'Back up',
  skip: 'Skip',
  needs_review: 'Needs review',
};

export const RECOMMENDATION_COLOR: Record<CandidateRecommendation, BadgeColor> =
  {
    back_up: 'success',
    skip: 'dark',
    needs_review: 'warning',
  };

export const DECISION_LABELS: Record<CandidateDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const DECISION_COLOR: Record<CandidateDecision, BadgeColor> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

/** What the decision filter shows: the three decisions, or everything. */
export type DecisionFilter = CandidateDecision | 'all';

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
): CandidateRecommendation | undefined {
  return value === 'back_up' || value === 'skip' || value === 'needs_review'
    ? value
    : undefined;
}

/**
 * True when the agent changed its recommendation after a human decided, so the
 * decision may deserve another look. A pending candidate has nothing to revisit.
 */
export function changedSinceDecision(
  candidate: Pick<ReviewCandidate, 'decision' | 'decidedAt' | 'recommendedAt'>,
): boolean {
  return (
    candidate.decision !== 'pending' &&
    candidate.decidedAt !== null &&
    Date.parse(candidate.recommendedAt) > Date.parse(candidate.decidedAt)
  );
}

const flag = (label: string, value: boolean | null): string =>
  `${label}: ${value === null ? 'unknown' : value ? 'yes' : 'no'}`;

/** One short line per git fact, so unknowns are visible rather than implied. */
export function describeGit(git: CandidateGitEvidence): string[] {
  return [
    `Remote: ${git.remoteUrl ?? 'none'} (${git.remoteVisibility})`,
    `Local state checked: ${git.localStateKnown ? 'yes' : 'no'}`,
    flag('Uncommitted changes', git.uncommittedChanges),
    flag('Untracked files', git.untrackedFiles),
    flag('Unpushed commits', git.unpushedCommits),
    flag('Notable ignored files', git.ignoredFilesOfNote),
  ];
}

export interface CandidateView {
  /** Source whose candidates are shown. */
  source?: string;
  /** Defaults to pending, so it is omitted from the URL. */
  decision?: DecisionFilter;
  recommendation?: CandidateRecommendation;
  /** Keyset cursor from the previous page. */
  after?: string;
}

const CANDIDATES_PATH = '/exodus/candidates';

/** Page URL for a view; defaults are left out so URLs stay short and shareable. */
export function candidatesUrl(view: CandidateView): string {
  const params = new URLSearchParams();

  if (view.source) params.set('source', view.source);
  if (view.decision && view.decision !== 'pending') {
    params.set('decision', view.decision);
  }
  if (view.recommendation) params.set('recommendation', view.recommendation);
  if (view.after) params.set('after', view.after);

  const query = params.toString();

  return query ? `${CANDIDATES_PATH}?${query}` : CANDIDATES_PATH;
}
