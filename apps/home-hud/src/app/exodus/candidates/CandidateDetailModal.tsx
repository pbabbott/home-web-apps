'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Typography,
} from '@abbottland/fui-components';
import {
  changedSinceDecision,
  DECISION_COLOR,
  DECISION_LABELS,
  describeGit,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
} from '../lib/candidate-display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';
import { formatDateTime } from '../lib/job-display';
import { decideReviewCandidate } from '../sources/lib/actions';
import type {
  CandidateDecision,
  ReviewCandidate,
} from '../sources/lib/homelab-api';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Typography variant="small" className="text-neutral-400">
        {title}
      </Typography>
      {children}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length === 0 ? (
    <Typography variant="body2" className="text-neutral-400">
      {empty}
    </Typography>
  ) : (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((item) => (
        <li key={item}>
          <Typography variant="body2" component="span" className="break-words">
            {item}
          </Typography>
        </li>
      ))}
    </ul>
  );
}

interface CandidateDetailModalProps {
  /** The candidate to review; null closes the modal. */
  candidate: ReviewCandidate | null;
  onClose: () => void;
  onDecided: () => void;
}

export function CandidateDetailModal({
  candidate,
  onClose,
  onDecided,
}: CandidateDetailModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setNote('');
    setError(null);
    onClose();
  }

  async function decide(decision: CandidateDecision) {
    if (!candidate) return;

    setSubmitting(true);
    setError(null);

    // An empty box leaves the note out, so the API keeps or clears it by its own rule.
    const result = await decideReviewCandidate(
      candidate.id,
      decision,
      note.trim() || undefined,
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNote('');
    onDecided();
  }

  const evidence = candidate?.evidence;

  return (
    <Modal
      open={candidate !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <ModalContent color="secondary">
        <ModalTitle>{candidate?.displayName}</ModalTitle>
        <ModalDescription className="break-all">
          {candidate?.rootPath}
        </ModalDescription>

        {candidate && evidence && (
          <div className="mt-4 flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={candidate.kind === 'file' ? 'dark' : 'secondary'}>
                {candidate.kind === 'file' ? 'file' : 'folder'}
              </Badge>
              <Badge color={RECOMMENDATION_COLOR[candidate.recommendation]}>
                Agent: {RECOMMENDATION_LABELS[candidate.recommendation]} (
                {candidate.confidence})
              </Badge>
              <Badge color={DECISION_COLOR[candidate.decision]}>
                {DECISION_LABELS[candidate.decision]}
              </Badge>
              {changedSinceDecision(candidate) && (
                <Badge color="warning">Agent changed its mind</Badge>
              )}
            </div>

            <Section title="Summary">
              <Typography variant="body2">{candidate.summary}</Typography>
            </Section>

            <Section title="Why the agent recommends this">
              <Typography variant="body2">
                {candidate.recommendationReason}
              </Typography>
              <Typography variant="small" className="text-neutral-400">
                {candidate.recommendedBy ?? 'agent'}, updated{' '}
                {formatDateTime(candidate.recommendedAt)} UTC
              </Typography>
            </Section>

            <Section title="Observations">
              <List items={evidence.observations} empty="None recorded." />
            </Section>

            {evidence.openQuestions.length > 0 && (
              <Section title="Still unknown">
                <List items={evidence.openQuestions} empty="" />
              </Section>
            )}

            {evidence.git && (
              <Section title="Git">
                <List items={describeGit(evidence.git)} empty="" />
              </Section>
            )}

            <Section title="Other">
              <List
                items={[
                  `Looks like: ${evidence.contentKinds.join(', ') || 'unclassified'}`,
                  `Reproducible elsewhere: ${evidence.reproducible}`,
                  `Enough information: ${evidence.sufficientInformation ? 'yes' : 'no'}`,
                  ...(evidence.estimatedSizeBytes !== undefined
                    ? [
                        `Estimated size: ${formatBytes(evidence.estimatedSizeBytes)}`,
                      ]
                    : []),
                  ...(evidence.estimatedFileCount !== undefined
                    ? [`Estimated files: ${evidence.estimatedFileCount}`]
                    : []),
                ]}
                empty=""
              />
            </Section>

            {candidate.decision !== 'pending' && (
              <Section title="Decision">
                <Typography variant="body2">
                  {DECISION_LABELS[candidate.decision]}
                  {candidate.decidedBy ? ` by ${candidate.decidedBy}` : ''}
                  {candidate.decidedAt
                    ? ` on ${formatDateTime(candidate.decidedAt)} UTC`
                    : ''}
                  {candidate.decisionNote ? `: ${candidate.decisionNote}` : ''}
                </Typography>
              </Section>
            )}

            <label className="flex flex-col gap-1">
              <Typography variant="small" className="text-neutral-400">
                Note (optional)
              </Typography>
              <Input
                color="primary"
                className="w-full"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        )}

        {error && (
          <Typography variant="body2" className="mt-4 text-error-400">
            {error}
          </Typography>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <OutlinedButton size="small" disabled={submitting} onClick={close}>
            Close
          </OutlinedButton>
          {candidate && candidate.decision !== 'pending' && (
            <OutlinedButton
              size="small"
              disabled={submitting}
              onClick={() => decide('pending')}
            >
              Reset to pending
            </OutlinedButton>
          )}
          {candidate?.decision !== 'rejected' && (
            <OutlinedButton
              size="small"
              disabled={submitting}
              onClick={() => decide('rejected')}
            >
              Reject
            </OutlinedButton>
          )}
          {candidate?.decision !== 'approved' && (
            <Button
              size="small"
              disabled={submitting}
              onClick={() => decide('approved')}
            >
              Approve
            </Button>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
