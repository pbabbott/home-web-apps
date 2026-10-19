import {
  DiscoveryError,
  decideReviewCandidate as decideReviewCandidateRow,
  getQueueItemById,
  getReviewCandidateById,
  getSourceById,
  listReviewCandidates as listReviewCandidateRows,
  upsertReviewCandidates,
  type Actor,
  type CandidateDecision,
  type CandidateEvidence,
  type CandidateRecommendation,
  type ReviewCandidate,
  type ReviewCandidateWithExclusion,
  type UpsertedCandidate,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import {
  isWithinPath,
  normalizeWindowsPath,
  windowsPathName,
} from '../../lib/windows-path';
import type { ReviewCandidateInput } from '../../schemas/discovery';

/**
 * Records the agent's proposals for the directory it holds. Each root path
 * must be that directory or lie beneath it: a worker can only report on what
 * it has claimed. Never touches human decisions.
 */
export async function proposeCandidates(
  queueItemId: string,
  claimToken: string,
  workerId: string | null,
  candidates: ReviewCandidateInput[],
): Promise<UpsertedCandidate[]> {
  const claimed = await getQueueItemById(db, queueItemId);
  if (!claimed) throw new DiscoveryError('not_found', 'queue item not found');

  const normalized = candidates.map((c) => {
    const { path, normalizedPath } = normalizeWindowsPath(c.rootPath);

    return {
      kind: c.kind,
      rootPath: path,
      normalizedRootPath: normalizedPath,
      displayName: c.displayName ?? windowsPathName(path),
      summary: c.summary,
      recommendation: c.recommendation,
      confidence: c.confidence,
      recommendationReason: c.reason,
      // This app compiles without strictNullChecks, which turns the schema's
      // `T | null` fields optional; the validated shape matches CandidateEvidence.
      evidence: c.evidence as CandidateEvidence,
    };
  });

  const outside = normalized.filter(
    (c) =>
      c.normalizedRootPath !== claimed.normalizedPath &&
      !isWithinPath(claimed.normalizedPath, c.normalizedRootPath),
  );
  if (outside.length > 0) {
    throw new DiscoveryError(
      'conflict',
      `paths are not inside the claimed directory ${claimed.path}`,
      { paths: outside.map((c) => c.rootPath) },
    );
  }

  return upsertReviewCandidates(db, queueItemId, {
    claimToken,
    workerId,
    candidates: normalized,
  });
}

export async function listSourceReviewCandidates(
  sourceId: string,
  filters: {
    jobId?: string;
    recommendation?: CandidateRecommendation;
    decision?: CandidateDecision;
    pathPrefix?: string;
    after?: string;
    limit?: number;
  },
): Promise<ReviewCandidate[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listReviewCandidateRows(db, {
    sourceId,
    jobId: filters.jobId,
    recommendation: filters.recommendation,
    decision: filters.decision,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    after: filters.after,
    limit: filters.limit,
  });
}

export const getReviewCandidate = (
  id: string,
): Promise<ReviewCandidateWithExclusion> => getReviewCandidateById(db, id);

export const decideReviewCandidate = (
  id: string,
  input: { decision: CandidateDecision; note?: string | null },
  actor: Actor,
): Promise<ReviewCandidate> =>
  decideReviewCandidateRow(db, id, { ...input, actor });
