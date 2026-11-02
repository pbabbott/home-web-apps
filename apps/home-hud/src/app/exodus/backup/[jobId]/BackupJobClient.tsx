'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { backupJobUrl, isActiveBackupJob } from '../../lib/backup-display';
import { useAutoRefresh } from '../../lib/useAutoRefresh';
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
import { BackupEntriesModal } from '../BackupEntriesModal';
import { BackupItemsPanel } from './BackupItemsPanel';
import { BackupJobHeader } from './BackupJobHeader';
import { BackupProgressPanel } from './BackupProgressPanel';
import { CancelBackupJobModal } from './CancelBackupJobModal';

interface Props {
  job: BackupJob;
  sourceName: string | null;
  destinationName: string | null;
  /** Null if the items could not be loaded. */
  items: BackupJobItem[] | null;
  hasMoreItems: boolean;
  statusFilter: BackupJobItemStatus | undefined;
}

/** Owns the page's state and the actions; the sections only render. */
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

  useAutoRefresh(isActiveBackupJob(job));

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
      <BackupJobHeader
        job={job}
        sourceName={sourceName}
        destinationName={destinationName}
      />

      <BackupProgressPanel
        job={job}
        busy={busy}
        notice={notice}
        error={confirmCancel ? null : error}
        onRetryFailed={() =>
          void run(
            () => retryFailedBackupItems(job.id),
            ({ retried }) =>
              setNotice(
                `Requeued ${retried} ${retried === 1 ? 'item' : 'items'}; each gets one more attempt.`,
              ),
          )
        }
        onRerun={() =>
          void run(
            () => rerunUnresolvedBackupJob(job.id),
            (created) => router.push(backupJobUrl(created.id)),
          )
        }
        onCancel={() => {
          setError(null);
          setConfirmCancel(true);
        }}
      />

      <BackupItemsPanel
        job={job}
        items={items}
        hasMoreItems={hasMoreItems}
        statusFilter={statusFilter}
        busy={busy}
        onShowFiles={setEntriesFor}
        onRetry={(item) => void run(() => retryBackupJobItem(item.id))}
      />

      {entriesFor && (
        <BackupEntriesModal
          item={entriesFor}
          onClose={() => setEntriesFor(null)}
        />
      )}

      <CancelBackupJobModal
        open={confirmCancel}
        busy={busy}
        error={error}
        onOpenChange={setConfirmCancel}
        onConfirm={() => void run(() => cancelBackupJob(job.id))}
      />
    </main>
  );
}
