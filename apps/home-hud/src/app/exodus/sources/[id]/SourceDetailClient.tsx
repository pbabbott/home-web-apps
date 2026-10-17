'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import type { Host } from '../../../infra/hosts/lib/homelab-api';
import { JOB_STATUS_COLOR, formatDateTime } from '../../lib/job-display';
import {
  cancelDiscoveryJob,
  completeDiscoveryJob,
  retryQueueItem,
} from '../lib/actions';
import {
  isActiveJob,
  type BackupSource,
  type DiscoveryJob,
  type DiscoveryJobWithCounts,
  type QueueItem,
  type QueueItemStatus,
} from '../lib/homelab-api';
import { StartJobModal } from './StartJobModal';

const COUNT_TILES: { status: QueueItemStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'failed', label: 'Failed' },
];

/** While a job is active the page re-fetches this often, so progress shows without a manual reload. */
const ACTIVE_REFRESH_MS = 5000;

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 border border-neutral-700 px-3 py-2">
      <Typography variant="caption" className="text-neutral-400">
        {label}
      </Typography>
      <Typography variant="h5" component="span">
        {value}
      </Typography>
    </div>
  );
}

function CurrentJobPanel({
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
              review them below.
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

function FailedItemsPanel({
  items,
  onRetried,
}: {
  items: QueueItem[];
  onRetried: () => void;
}) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(id: string) {
    setRetryingId(id);
    setError(null);
    const result = await retryQueueItem(id);
    setRetryingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onRetried();
  }

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Typography variant="h5" component="h2">
          Failed Directories
        </Typography>
        <Badge color="error">{items.length}</Badge>
      </div>

      <ScrollableTable className="mb-0">
        <Table size="small">
          <TableHead>
            <TableRow>
              <Th>Path</Th>
              <Th>Attempts</Th>
              <Th>Last error</Th>
              <Th>Failed (UTC)</Th>
              <Th>&nbsp;</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <Td className="break-all">{item.path}</Td>
                <Td>
                  {item.attemptCount} / {item.maxAttempts}
                </Td>
                <Td>{item.lastError ?? '—'}</Td>
                <Td>{formatDateTime(item.updatedAt)}</Td>
                <Td>
                  <OutlinedButton
                    size="small"
                    disabled={retryingId !== null}
                    onClick={() => void retry(item.id)}
                  >
                    {retryingId === item.id ? 'Retrying…' : 'Retry'}
                  </OutlinedButton>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>

      {error && (
        <Typography variant="body2" className="text-error-400">
          {error}
        </Typography>
      )}
    </Panel>
  );
}

function JobHistoryPanel({ jobs }: { jobs: DiscoveryJob[] }) {
  return (
    <Panel color="default" className="flex flex-col gap-4">
      <Typography variant="h5" component="h2">
        Job History
      </Typography>

      <ScrollableTable className="mb-0">
        <Table size="small">
          <TableHead>
            <TableRow>
              <Th>Status</Th>
              <Th>Root</Th>
              <Th>Created (UTC)</Th>
              <Th>Finished (UTC)</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <Td>
                  <Badge color={JOB_STATUS_COLOR[job.status]}>
                    {job.status}
                  </Badge>
                </Td>
                <Td className="break-all">{job.rootPath}</Td>
                <Td>{formatDateTime(job.createdAt)}</Td>
                <Td>{formatDateTime(job.finishedAt)}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Panel>
  );
}

interface SourceDetailClientProps {
  source: BackupSource;
  host: Host | null;
  jobs: DiscoveryJob[] | null;
  latestJob: DiscoveryJobWithCounts | null;
  failedItems: QueueItem[] | null;
  hasActiveJob: boolean;
}

export function SourceDetailClient({
  source,
  host,
  jobs,
  latestJob,
  failedItems,
  hasActiveJob,
}: SourceDetailClientProps) {
  const router = useRouter();
  const [startModalOpen, setStartModalOpen] = useState(false);

  useEffect(() => {
    if (!hasActiveJob) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasActiveJob, router]);

  const refresh = () => router.refresh();

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/exodus/sources"
          className="text-primary-400 hover:underline"
        >
          <Typography variant="small" component="span">
            ← Backup Sources
          </Typography>
        </Link>
        <Typography variant="h1" component="h1" className="break-all">
          {source.name}
        </Typography>
        <Typography variant="body2" className="text-neutral-400">
          {host
            ? `${host.name} (${host.ipAddress})`
            : source.hostId
              ? 'Host unavailable'
              : 'No host linked'}{' '}
          · {source.sourceType}
        </Typography>
      </div>

      {jobs === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load discovery jobs from homelab-api.
        </Typography>
      ) : (
        <CurrentJobPanel
          job={latestJob}
          hasActiveJob={hasActiveJob}
          onStart={() => setStartModalOpen(true)}
          onChanged={refresh}
        />
      )}

      {failedItems === null ? (
        <Typography variant="body2" className="text-error-400">
          Failed to load failed directories from homelab-api.
        </Typography>
      ) : (
        failedItems.length > 0 && (
          <FailedItemsPanel items={failedItems} onRetried={refresh} />
        )
      )}

      {jobs && jobs.length > 0 && <JobHistoryPanel jobs={jobs} />}

      <StartJobModal
        sourceId={source.id}
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        onStarted={refresh}
      />
    </main>
  );
}
