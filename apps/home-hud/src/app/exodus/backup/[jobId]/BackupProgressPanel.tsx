import Link from 'next/link';
import {
  Button,
  OutlinedButton,
  Panel,
  Typography,
} from '@abbottland/fui-components';
import {
  backupCoverageUrl,
  backupProgress,
  canCancelBackupJob,
  canRerunBackupJob,
  canRetryFailedBackupItems,
  stalledReasonText,
} from '../../lib/backup-display';
import { LocalDateTime } from '../../lib/LocalDateTime';
import type {
  BackupJob,
  BackupJobItemStatus,
} from '../../sources/lib/homelab-api';
import { CountTile } from '../../sources/[id]/CountTile';

export const COUNT_TILES: { status: BackupJobItemStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'verified', label: 'Verified' },
  { status: 'failed', label: 'Failed' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'excluded', label: 'Excluded' },
];

interface Props {
  job: BackupJob;
  busy: boolean;
  notice: string | null;
  error: string | null;
  onRetryFailed: () => void;
  onRerun: () => void;
  onCancel: () => void;
}

export function BackupProgressPanel({
  job,
  busy,
  notice,
  error,
  onRetryFailed,
  onRerun,
  onCancel,
}: Props) {
  const progress = backupProgress(job.progress);

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography variant="h5" component="h2">
          Progress
        </Typography>
        <div className="flex flex-wrap items-center gap-2">
          <OutlinedButton
            component={Link}
            href={backupCoverageUrl(job.sourceId, job.destinationId)}
            color="accent-falcon"
            size="small"
          >
            Coverage →
          </OutlinedButton>
          {canRetryFailedBackupItems(job) && (
            <OutlinedButton
              size="small"
              disabled={busy}
              onClick={onRetryFailed}
            >
              Retry failed
            </OutlinedButton>
          )}
          {canRerunBackupJob(job) && (
            <OutlinedButton size="small" disabled={busy} onClick={onRerun}>
              Rerun unresolved
            </OutlinedButton>
          )}
          {canCancelBackupJob(job) && (
            <Button
              size="small"
              color="error"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel job
            </Button>
          )}
        </div>
      </div>

      {job.stalledReason && (
        <Typography variant="body2" className="text-warning-400">
          {stalledReasonText(job.stalledReason)}
          {job.stalledSince && (
            <>
              {' Paused since '}
              <LocalDateTime iso={job.stalledSince} />.
            </>
          )}
        </Typography>
      )}
      {job.status === 'planned' && (
        <Typography variant="body2" className="text-neutral-400">
          Waiting for the destination’s worker to pick it up.
        </Typography>
      )}
      {job.status === 'completed_with_issues' && (
        <Typography variant="body2" className="text-warning-400">
          Finished, but some items failed or were blocked. Review them below;
          “Rerun unresolved” plans a new job for them.
        </Typography>
      )}
      {job.progress.staleClaims > 0 && (
        <Typography variant="body2" className="text-neutral-400">
          {job.progress.staleClaims} item(s) have an expired lease; the next
          claim picks them up again.
        </Typography>
      )}
      {job.error && (
        <Typography variant="body2" className="text-error-400">
          {job.error}
        </Typography>
      )}

      <Typography variant="body2">
        {progress.itemsDone} of {progress.itemsTotal} items done ·{' '}
        {progress.files} · {progress.bytes}
      </Typography>
      {progress.estimateIsFloor && (
        <Typography variant="caption" className="text-neutral-400">
          Some items have no size estimate, so the total is a minimum.
        </Typography>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {COUNT_TILES.map(({ status, label }) => (
          <CountTile
            key={status}
            label={label}
            value={job.progress.itemCounts[status]}
            color={
              status === 'failed' || status === 'blocked'
                ? 'error'
                : status === 'verified'
                  ? 'success'
                  : undefined
            }
          />
        ))}
      </div>

      {notice && <Typography variant="body2">{notice}</Typography>}
      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}
    </Panel>
  );
}
