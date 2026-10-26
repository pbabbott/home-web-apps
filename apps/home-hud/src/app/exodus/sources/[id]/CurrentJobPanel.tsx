'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Panel,
  Typography,
} from '@abbottland/fui-components';
import { LocalDateTime } from '../../lib/LocalDateTime';
import {
  JOB_STATUS_COLOR,
  QUEUE_STATUS_COLOR,
  jobPhase,
} from '../../lib/job-display';
import {
  cancelDiscoveryJob,
  completeDiscoveryJob,
  failDiscoveryJob,
} from '../lib/actions';
import {
  isActiveJob,
  type DiscoveryJobWithCounts,
  type QueueItemStatus,
} from '../lib/homelab-api';
import { CountTile } from './CountTile';

const COUNT_TILES: { status: QueueItemStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'failed', label: 'Failed' },
];

/** Discovery is drained: finishing is the next step, and failures are worth naming. */
function completeLabel(job: DiscoveryJobWithCounts): string {
  const failed = job.queueCounts.failed;

  return job.phase === 'awaiting_completion' && failed > 0
    ? `Complete with ${failed} failed`
    : 'Mark Complete';
}

export function CurrentJobPanel({
  job,
  hasActiveJob,
  onStart,
  onChanged,
}: {
  job: DiscoveryJobWithCounts | null;
  hasActiveJob: boolean;
  onStart: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState('');

  async function run(
    action: (jobId: string) => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (!job) return;

    setBusy(true);
    setError(null);
    const result = await action(job.id);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Request failed');
      return;
    }

    setConfirmCancelOpen(false);
    setFailOpen(false);
    setFailReason('');
    onChanged();
  }

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Typography variant="h5" component="h2">
            {job && isActiveJob(job) ? 'Current Job' : 'Latest Job'}
          </Typography>
          {job && (
            <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {job && isActiveJob(job) && (
            <>
              {job.phase === 'awaiting_completion' ? (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => void run(completeDiscoveryJob)}
                >
                  {completeLabel(job)}
                </Button>
              ) : (
                <OutlinedButton
                  size="small"
                  disabled={busy}
                  onClick={() => void run(completeDiscoveryJob)}
                >
                  {completeLabel(job)}
                </OutlinedButton>
              )}
              <OutlinedButton
                size="small"
                color="error"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setFailOpen(true);
                }}
              >
                Mark Failed
              </OutlinedButton>
              <Button
                size="small"
                color="error"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setConfirmCancelOpen(true);
                }}
              >
                Cancel Job
              </Button>
            </>
          )}
          {!hasActiveJob && (
            <OutlinedButton size="small" onClick={onStart}>
              + Start Job
            </OutlinedButton>
          )}
        </div>
      </div>

      {!job ? (
        <Typography variant="body2" className="text-neutral-400">
          No discovery jobs yet. Start one to queue a directory for the agent.
        </Typography>
      ) : (
        <>
          {isActiveJob(job) && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={jobPhase(job.queueCounts, job.staleClaims).color}>
                {jobPhase(job.queueCounts, job.staleClaims).label}
              </Badge>
              <Typography variant="body2">
                {jobPhase(job.queueCounts, job.staleClaims).detail}
              </Typography>
            </div>
          )}
          <Typography variant="body2" className="break-all text-neutral-400">
            {job.rootPath}
            {job.startedAt && (
              <>
                {' · started '}
                <LocalDateTime iso={job.startedAt} />
              </>
            )}
            {job.finishedAt && (
              <>
                {' · finished '}
                <LocalDateTime iso={job.finishedAt} />
              </>
            )}
          </Typography>

          <OutlinedButton
            component={Link}
            href={`/exodus/jobs/${job.id}`}
            color="accent-falcon"
            size="small"
            className="self-start"
          >
            View job details →
          </OutlinedButton>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COUNT_TILES.map(({ status, label }) => (
              <CountTile
                key={status}
                label={label}
                value={job.queueCounts[status]}
                color={QUEUE_STATUS_COLOR[status]}
              />
            ))}
          </div>

          {job.status === 'completed' && job.queueCounts.failed > 0 && (
            <Typography variant="body2" className="text-warning-400">
              Finished with {job.queueCounts.failed} failed{' '}
              {job.queueCounts.failed === 1 ? 'directory' : 'directories'} —
              review them below. Start a new job to explore them again.
            </Typography>
          )}

          {job.error && (
            <Typography variant="body2" className="text-error-400">
              {job.error}
            </Typography>
          )}
        </>
      )}

      {error && !confirmCancelOpen && !failOpen && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}

      <Modal open={failOpen} onOpenChange={setFailOpen}>
        <ModalContent color="secondary">
          <ModalTitle>Mark this job failed?</ModalTitle>
          <ModalDescription>
            Use this when the run itself is broken (machine unreachable, agent
            misbehaving). Cancel is for stopping a healthy run. In-progress
            directories are released; the reason is shown on the job.
          </ModalDescription>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run((jobId) => failDiscoveryJob(jobId, failReason.trim()));
            }}
          >
            <label className="flex flex-col gap-1">
              <Typography variant="body2" className="text-neutral-400">
                Reason
              </Typography>
              <Input
                required
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="source machine offline"
              />
            </label>
            {error && (
              <Typography variant="body2" className="text-error-400">
                {error}
              </Typography>
            )}
            <div className="flex justify-end gap-3">
              <OutlinedButton
                type="button"
                size="small"
                disabled={busy}
                onClick={() => setFailOpen(false)}
              >
                Keep Running
              </OutlinedButton>
              <Button
                type="submit"
                size="small"
                color="error"
                disabled={busy || !failReason.trim()}
              >
                {busy ? 'Failing…' : 'Mark Failed'}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>

      <Modal open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <ModalContent color="secondary">
          <ModalTitle>Cancel this job?</ModalTitle>
          <ModalDescription>
            The agent stops claiming work for it. Directories already discovered
            stay queued, and a new job on this source will pick them up.
          </ModalDescription>
          {error && (
            <Typography variant="body2" className="text-error-400">
              {error}
            </Typography>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <OutlinedButton
              type="button"
              size="small"
              disabled={busy}
              onClick={() => setConfirmCancelOpen(false)}
            >
              Keep Running
            </OutlinedButton>
            <Button
              type="button"
              size="small"
              color="error"
              disabled={busy}
              onClick={() => void run(cancelDiscoveryJob)}
            >
              {busy ? 'Cancelling…' : 'Cancel Job'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </Panel>
  );
}
