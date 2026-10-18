'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
  OutlinedButton,
  Panel,
  Typography,
} from '@abbottland/fui-components';
import { JOB_STATUS_COLOR, formatDateTime } from '../../lib/job-display';
import { cancelDiscoveryJob, completeDiscoveryJob } from '../lib/actions';
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
    onChanged();
  }

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Typography variant="h5" component="h2">
            {job && isActiveJob(job) ? 'Current Job' : 'Latest Job'}
          </Typography>
          {job && (
            <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {job && isActiveJob(job) && (
            <>
              <OutlinedButton
                size="small"
                disabled={busy}
                onClick={() => void run(completeDiscoveryJob)}
              >
                Mark Complete
              </OutlinedButton>
              <Button
                size="small"
                color="error"
                disabled={busy}
                onClick={() => setConfirmCancelOpen(true)}
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
          <Typography variant="body2" className="break-all text-neutral-400">
            {job.rootPath}
            {job.startedAt ? ` · started ${formatDateTime(job.startedAt)}` : ''}
            {job.finishedAt
              ? ` · finished ${formatDateTime(job.finishedAt)}`
              : ''}
            {' (UTC)'}
          </Typography>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COUNT_TILES.map(({ status, label }) => (
              <CountTile
                key={status}
                label={label}
                value={job.queueCounts[status]}
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

      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}

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
