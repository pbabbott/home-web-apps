import { HOMELAB_API_URL } from './config';

export type CandidateKind = 'file' | 'directory';
export type CandidateRecommendation = 'back_up' | 'skip' | 'needs_review';
export type CandidateConfidence = 'low' | 'medium' | 'high';
export type CandidateDecision = 'pending' | 'approved' | 'rejected';

export interface CandidateGitEvidence {
  remoteUrl: string | null;
  remoteVisibility: 'public' | 'private' | 'none' | 'unknown';
  localStateKnown: boolean;
  uncommittedChanges: boolean | null;
  untrackedFiles: boolean | null;
  unpushedCommits: boolean | null;
  ignoredFilesOfNote: boolean | null;
}

export interface CandidateEvidence {
  contentKinds: string[];
  /** Null when the path is not a git repository (or was not checked). */
  git: CandidateGitEvidence | null;
  reproducible: 'yes' | 'no' | 'unknown';
  sufficientInformation: boolean;
  observations: string[];
  openQuestions: string[];
  estimatedSizeBytes?: number;
  estimatedFileCount?: number;
}

export interface ReviewCandidate {
  id: string;
  sourceId: string;
  kind: CandidateKind;
  rootPath: string;
  /** Lowercased path; the cursor for the next page. */
  normalizedRootPath: string;
  displayName: string;
  summary: string;
  /** The agent's view. Never an approval. */
  recommendation: CandidateRecommendation;
  confidence: CandidateConfidence;
  recommendationReason: string;
  evidence: CandidateEvidence;
  recommendedAt: string;
  recommendedBy: string | null;
  /** The human's call; separate from the recommendation above. */
  decision: CandidateDecision;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ReviewCandidateQuery {
  recommendation?: CandidateRecommendation;
  decision?: CandidateDecision;
  /** The `normalizedRootPath` of the last candidate of the previous page. */
  after?: string;
  limit?: number;
}

/** A page of a source's review candidates, ordered by normalized path. */
export async function getReviewCandidates(
  sourceId: string,
  query: ReviewCandidateQuery,
): Promise<ReviewCandidate[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const res = await fetch(
    `${HOMELAB_API_URL}/sources/${sourceId}/review-candidates?${params}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /sources/${sourceId}/review-candidates returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as ReviewCandidate[];
}
