'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
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
  BACKUP_ITEM_STATUS_COLOR,
  BACKUP_JOB_STATUS_COLOR,
  backupCoverageUrl,
  backupJobUrl,
  backupOverviewUrl,
  backupProgress,
  canCancelBackupJob,
  canRerunBackupJob,
  canRetryBackupItem,
  canRetryFailedBackupItems,
  isActiveBackupJob,
  stalledReasonText,
} from '../../lib/backup-display';
import { formatDuration } from '../../lib/job-display';
import { LocalDateTime } from '../../lib/LocalDateTime';
import {
  cancelBackupJob,
  rerunUnresolvedBackupJob,
  retryBackupJobItem,
  retryFailedBackupItems,
} from '../../sources/lib/actions';
import type {
  BackupJob,
  BackupJobItem,
  BackupJobItemStatus,
} from '../../sources/lib/homelab-api';
import { CountTile } from '../../sources/[id]/CountTile';
import { BackupEntriesModal } from '../BackupEntriesModal';

const REFRESH_MS = 5000;

const COUNT_TILES: { status: BackupJobItemStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'verified', label: 'Verified' },
  { status: 'failed', label: 'Failed' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'excluded', label: 'Excluded' },
];

const FILTER_STATUSES: (BackupJobItemStatus | undefined)[] = [
  undefined,
  ...COUNT_TILES.map((tile) => tile.status),
];

interface Props {
  job: BackupJob;
  sourceName: string | null;
  destinationName: string | null;
  /** Null if the items could not be loaded. */
  items: BackupJobItem[] | null;
  hasMoreItems: boolean;
  statusFilter: BackupJobItemStatus | undefined;
}

export function BackupJobClient({
  job,
  sourceName,
  destinationName,
  items,
  hasMoreItems,
  statusFilter,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [entriesFor, setEntriesFor] = useState<BackupJobItem | null>(null);

  const active = isActiveBackupJob(job);
  const progress = backupProgress(job.progress);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  async function run<T>(
    action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    onDone?: (data: T) => void,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await action();
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmCancel(false);
    onDone?.(result.data);
    router.refresh();
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href={backupOverviewUrl(job.sourceId, job.destinationId)}
          color="secondary"
          size="small"
          className="self-start"
        >
          ← Backup
        </OutlinedButton>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h1" component="h1">
            Backup job {job.id.slice(0, 8)}
          </Typography>
          <Badge color={BACKUP_JOB_STATUS_COLOR[job.status]}>
            {job.status}
          </Badge>
        </div>
        <Typography variant="body2" className="break-all text-neutral-400">
          {sourceName ?? 'Unknown source'} → {destinationName ?? 'destination'}{' '}
          / {job.sourceDirName}
          {' · created '}
          <LocalDateTime iso={job.createdAt} />
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
              {` (${formatDuration(job.startedAt ?? job.createdAt, job.finishedAt)})`}
            </>
          )}
        </Typography>
      </div>

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
                onClick={() =>
                  void run(
                    () => retryFailedBackupItems(job.id),
                    ({ retried }) =>
                      setNotice(
                        `Requeued ${retried} ${retried === 1 ? 'item' : 'items'}; each gets one more attempt.`,
                      ),
                  )
                }
              >
                Retry failed
              </OutlinedButton>
            )}
            {canRerunBackupJob(job) && (
              <OutlinedButton
                size="small"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => rerunUnresolvedBackupJob(job.id),
                    (created) => router.push(backupJobUrl(created.id)),
                  )
                }
              >
                Rerun unresolved
              </OutlinedButton>
            )}
            {canCancelBackupJob(job) && (
              <Button
                size="small"
                color="error"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setConfirmCancel(true);
                }}
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
        {error && !confirmCancel && (
          <Typography variant="body2" className="text-error-400">
            {error}
          </Typography>
        )}
      </Panel>

      <Panel color="default" className="flex flex-col gap-4">
        <Typography variant="h5" component="h2">
          Items
        </Typography>

        <div className="flex flex-wrap gap-2">
          {FILTER_STATUSES.map((status) => (
            <OutlinedButton
              key={status ?? 'all'}
              component={Link}
              href={backupJobUrl(job.id, status)}
              size="small"
              color={status === statusFilter ? 'accent-falcon' : undefined}
            >
              {status ?? 'all'}
            </OutlinedButton>
          ))}
        </div>

        {items === null ? (
          <Typography variant="body2" className="text-error-400">
            Failed to load the items from homelab-api.
          </Typography>
        ) : items.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            No items{statusFilter ? ` with status ${statusFilter}` : ''}.
          </Typography>
        ) : (
          <ScrollableTable className="mb-0">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <Th>Path</Th>
                  <Th>Status</Th>
                  <Th>Attempts</Th>
                  <Th>Last error</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <Td className="break-all">
                      {item.rootPath}
                      {item.kind === 'directory' ? ' (folder)' : ''}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <Badge color={BACKUP_ITEM_STATUS_COLOR[item.status]}>
                          {item.status}
                        </Badge>
                        {item.statusReason && (
                          <Typography
                            variant="caption"
                            className="text-neutral-400"
                          >
                            {item.statusReason.replaceAll('_', ' ')}
                          </Typography>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {item.attemptCount} / {item.maxAttempts}
                    </Td>
                    <Td className="break-all">{item.lastError ?? '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {(item.status === 'verified' ||
                          item.status === 'in_progress' ||
                          item.status === 'failed' ||
                          item.status === 'blocked' ||
                          item.status === 'queued') && (
                          <OutlinedButton
                            size="small"
                            onClick={() => setEntriesFor(item)}
                          >
                            Files
                          </OutlinedButton>
                        )}
                        {canRetryBackupItem(job, item) && (
                          <OutlinedButton
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              void run(() => retryBackupJobItem(item.id))
                            }
                          >
                            Retry
                          </OutlinedButton>
                        )}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        )}

        {hasMoreItems && (
          <Typography variant="body2" className="text-warning-400">
            Showing the first {items?.length} items by path. Filter by status to
            narrow it down.
          </Typography>
        )}
      </Panel>

      {entriesFor && (
        <BackupEntriesModal
          item={entriesFor}
          onClose={() => setEntriesFor(null)}
        />
      )}

      <Modal open={confirmCancel} onOpenChange={setConfirmCancel}>
        <ModalContent color="secondary">
          <ModalTitle>Cancel this backup job?</ModalTitle>
          <ModalDescription>
            The worker stops copying for it. Files already verified stay on the
            destination and count as covered; items not yet done stay queued as
            the record. A new job can pick them up.
          </ModalDescription>
          {error && (
            <Typography variant="body2" className="mt-2 text-error-400">
              {error}
            </Typography>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <OutlinedButton
              type="button"
              size="small"
              disabled={busy}
              onClick={() => setConfirmCancel(false)}
            >
              Keep running
            </OutlinedButton>
            <Button
              type="button"
              size="small"
              color="error"
              disabled={busy}
              onClick={() => void run(() => cancelBackupJob(job.id))}
            >
              {busy ? 'Cancelling…' : 'Cancel job'}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </main>
  );
}
