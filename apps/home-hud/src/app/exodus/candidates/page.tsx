import {
  parseDecisionFilter,
  parseRecommendation,
} from '../lib/candidate-display';
import {
  getReviewCandidates,
  getSources,
  type ReviewCandidate,
  type Source,
} from '../sources/lib/homelab-api';
import { CandidatesClient } from './CandidatesClient';

type PageProps = {
  searchParams: Promise<{
    source?: string;
    decision?: string;
    recommendation?: string;
    after?: string;
  }>;
};

const PAGE_SIZE = 50;

export default async function ExodusCandidatesPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;

  let sources: Source[] | null = null;

  try {
    sources = await getSources();
  } catch (err) {
    console.error('Failed to load sources from homelab-api:', err);
  }

  // A missing or unknown source (a stale or hand-edited URL) falls back to the
  // first one, so the page always lands on something reviewable.
  const source =
    sources?.find((candidate) => candidate.id === query.source) ??
    sources?.[0] ??
    null;

  const decision = parseDecisionFilter(query.decision);
  const recommendation = parseRecommendation(query.recommendation);
  const after = query.after || undefined;

  let candidates: ReviewCandidate[] | null = null;

  if (source) {
    try {
      candidates = await getReviewCandidates(source.id, {
        decision: decision === 'all' ? undefined : decision,
        recommendation,
        after,
        limit: PAGE_SIZE,
      });
    } catch (err) {
      console.error('Failed to load review candidates from homelab-api:', err);
    }
  }

  return (
    <CandidatesClient
      sources={sources?.map(({ id, name }) => ({ id, name })) ?? null}
      sourceId={source?.id ?? null}
      decision={decision}
      recommendation={recommendation}
      isFirstPage={!after}
      candidates={candidates}
      // A full page may have more behind it; the cursor is the last row seen.
      nextCursor={
        candidates && candidates.length === PAGE_SIZE
          ? candidates[candidates.length - 1].normalizedRootPath
          : null
      }
    />
  );
}
