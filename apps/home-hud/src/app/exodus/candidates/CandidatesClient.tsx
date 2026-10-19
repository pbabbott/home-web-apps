'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Typography,
} from '@abbottland/fui-components';
import {
  candidatesUrl,
  changedSinceDecision,
  DECISION_COLOR,
  DECISION_LABELS,
  parseDecisionFilter,
  parseRecommendation,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
  type DecisionFilter,
} from '../lib/candidate-display';
import { formatDateTime } from '../lib/job-display';
import { decideReviewCandidate } from '../sources/lib/actions';
import type {
  CandidateDecision,
  CandidateRecommendation,
  ReviewCandidate,
} from '../sources/lib/homelab-api';
import { CandidateDetailModal } from './CandidateDetailModal';

interface CandidatesClientProps {
  /** Null if the sources could not be loaded. */
  sources: { id: string; name: string }[] | null;
  /** The source being reviewed; null if there are none. */
  sourceId: string | null;
  decision: DecisionFilter;
  recommendation: CandidateRecommendation | undefined;
  isFirstPage: boolean;
  /** Null if the candidates could not be loaded. */
  candidates: ReviewCandidate[] | null;
  nextCursor: string | null;
}

const selectClass =
  'border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0';

export function CandidatesClient({
  sources,
  sourceId,
  decision,
  recommendation,
  isFirstPage,
  candidates,
  nextCursor,
}: CandidatesClientProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = { source: sourceId ?? undefined, decision, recommendation };
  // Looked up by id so the modal shows fresh data after a refresh.
  const open = candidates?.find((c) => c.id === openId) ?? null;

  async function quickDecide(
    candidate: ReviewCandidate,
    next: CandidateDecision,
  ) {
    setBusyId(candidate.id);
    setError(null);

    const result = await decideReviewCandidate(candidate.id, next);
    setBusyId(null);

    if (!result.ok) {
      setError(`${candidate.displayName}: ${result.error}`);
      return;
    }

    router.refresh();
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <Typography variant="h1" component="h1">
          Review Candidates
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          Backup units the agent proposes. Its recommendation is advice only:
          nothing is approved until you approve it, and an approval covers
          everything beneath the path.
        </Typography>
      </div>

      {sources === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load sources from homelab-api.
        </Typography>
      ) : sources.length === 0 || sourceId === null ? (
        <Typography variant="body2" className="text-neutral-400">
          No sources yet.{' '}
          <Link
            href="/exodus/sources"
            className="text-primary-400 hover:underline"
          >
            Add one
          </Link>{' '}
          and run a discovery job to get candidates.
        </Typography>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Source
            </Typography>
            <select
              value={sourceId}
              onChange={(e) =>
                router.push(candidatesUrl({ ...view, source: e.target.value }))
              }
              className={selectClass}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Decision
            </Typography>
            <select
              value={decision}
              onChange={(e) =>
                router.push(
                  candidatesUrl({
                    ...view,
                    decision: parseDecisionFilter(e.target.value),
                  }),
                )
              }
              className={selectClass}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <Typography variant="small" className="text-neutral-400">
              Agent says
            </Typography>
            <select
              value={recommendation ?? ''}
              onChange={(e) =>
                router.push(
                  candidatesUrl({
                    ...view,
                    recommendation: parseRecommendation(e.target.value),
                  }),
                )
              }
              className={selectClass}
            >
              <option value="">Anything</option>
              {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <OutlinedButton
            component={Link}
            href={`/exodus/sources/${sourceId}`}
            color="accent-falcon"
            size="small"
          >
            View source →
          </OutlinedButton>
        </div>
      )}

      {sourceId !== null && (
        <Panel color="default" className="flex flex-col gap-4">
          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}

          {candidates === null ? (
            <Typography variant="body2" className="text-error-400">
              Failed to load review candidates from homelab-api.
            </Typography>
          ) : candidates.length === 0 ? (
            <Typography variant="body2" className="text-neutral-400">
              {!isFirstPage
                ? 'No more candidates.'
                : decision === 'pending' && !recommendation
                  ? 'Nothing waiting for review.'
                  : 'No candidates match these filters.'}
            </Typography>
          ) : (
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Path</Th>
                    <Th>Type</Th>
                    <Th>Agent says</Th>
                    <Th>Confidence</Th>
                    <Th>Decision</Th>
                    <Th>Updated (UTC)</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <Td className="break-all">
                        <button
                          type="button"
                          onClick={() => setOpenId(candidate.id)}
                          className="text-left text-primary-400 hover:underline"
                        >
                          {candidate.rootPath}
                        </button>
                        <Typography
                          variant="small"
                          className="text-neutral-400"
                        >
                          {candidate.summary}
                        </Typography>
                      </Td>
                      <Td>
                        <Badge
                          color={
                            candidate.kind === 'file' ? 'dark' : 'secondary'
                          }
                        >
                          {candidate.kind === 'file' ? 'file' : 'folder'}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge
                          color={RECOMMENDATION_COLOR[candidate.recommendation]}
                        >
                          {RECOMMENDATION_LABELS[candidate.recommendation]}
                        </Badge>
                      </Td>
                      <Td>{candidate.confidence}</Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge color={DECISION_COLOR[candidate.decision]}>
                            {DECISION_LABELS[candidate.decision]}
                          </Badge>
                          {changedSinceDecision(candidate) && (
                            <Badge color="warning">Agent changed</Badge>
                          )}
                        </div>
                      </Td>
                      <Td>{formatDateTime(candidate.recommendedAt)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <OutlinedButton
                            size="small"
                            onClick={() => setOpenId(candidate.id)}
                          >
                            Details
                          </OutlinedButton>
                          {candidate.decision === 'pending' && (
                            <>
                              <Button
                                size="small"
                                disabled={busyId === candidate.id}
                                onClick={() =>
                                  quickDecide(candidate, 'approved')
                                }
                              >
                                Approve
                              </Button>
                              <OutlinedButton
                                size="small"
                                disabled={busyId === candidate.id}
                                onClick={() =>
                                  quickDecide(candidate, 'rejected')
                                }
                              >
                                Reject
                              </OutlinedButton>
                            </>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}

          {candidates !== null && (!isFirstPage || nextCursor) && (
            <div className="flex items-center justify-between gap-3">
              {isFirstPage ? (
                <span />
              ) : (
                <Link
                  href={candidatesUrl(view)}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    ← First page
                  </Typography>
                </Link>
              )}
              {nextCursor && (
                <Link
                  href={candidatesUrl({ ...view, after: nextCursor })}
                  className="text-primary-400 hover:underline"
                >
                  <Typography variant="small" component="span">
                    Next page →
                  </Typography>
                </Link>
              )}
            </div>
          )}
        </Panel>
      )}

      <CandidateDetailModal
        candidate={open}
        onClose={() => setOpenId(null)}
        onDecided={() => {
          setOpenId(null);
          router.refresh();
        }}
      />
    </main>
  );
}
