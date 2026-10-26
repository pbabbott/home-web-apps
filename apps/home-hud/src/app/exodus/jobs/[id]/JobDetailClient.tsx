'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@abbottland/fui-icons';
import {
  Badge,
  OutlinedButton,
  Panel,
  ScrollableTable,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  Tooltip,
  TransparentPanel,
  Typography,
} from '@abbottland/fui-components';
import {
  JOB_STATUS_COLOR,
  QUEUE_STATUS_COLOR,
  QUEUE_STATUS_DESCRIPTION,
  comparePaths,
  describeSkips,
  directoryDetailUrl,
  formatDuration,
  isStaleClaim,
  jobDetailUrl,
  jobPhase,
} from '../../lib/job-display';
import {
  JobActivity,
  JobProgress,
  QueueItemMessage,
} from '../../lib/JobSummary';
import { Detail, ReviewedMark } from '../../lib/DirectoryReview';
import { LocalDateTime } from '../../lib/LocalDateTime';
import { CountTile } from '../../sources/[id]/CountTile';
import { QueueDirectoriesModal } from './QueueDirectoriesModal';
import {
  retryFailedQueueItems,
  retryQueueItem,
} from '../../sources/lib/actions';
import {
  JOB_QUEUE_ITEMS_LIMIT,
  isActiveJob,
  type DiscoveryJobWithCounts,
  type JobQueueItem,
  type QueueItemStatus,
} from '../../sources/lib/homelab-api';

/** While the job is active the page re-fetches this often, so the agent's progress shows without a reload. */
const ACTIVE_REFRESH_MS = 5000;

const STATUS_FILTERS: { status: QueueItemStatus; label: string }[] = [
  { status: 'queued', label: 'Queued' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Completed' },
  { status: 'skipped', label: 'Skipped' },
  { status: 'failed', label: 'Failed' },
];

interface JobDetailClientProps {
  job: DiscoveryJobWithCounts;
  /** Null if the sources could not be loaded. */
  sourceName: string | null;
  /** Null if the queue items could not be loaded. */
  items: JobQueueItem[] | null;
  /** The `?status=` filter, if any. */
  status: QueueItemStatus | null;
}

export function JobDetailClient({
  job,
  sourceName,
  items,
  status,
}: JobDetailClientProps) {
  const router = useRouter();
  const sortedItems = useMemo(
    () =>
      items ? [...items].sort((a, b) => comparePaths(a.path, b.path)) : null,
    [items],
  );
  const active = isActiveJob(job);
  const [queueing, setQueueing] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<string | 'all' | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  // Set after mount: lease expiry compared against the server's clock at render
  // time would not match what the browser computes during hydration.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);

    return () => clearTimeout(timer);
  }, [items]);

  // From the server, so a status filter on the table cannot hide stuck claims.
  const phase = active ? jobPhase(job.queueCounts, job.staleClaims) : null;

  async function retry(target: string | 'all') {
    setRetrying(target);
    setRetryError(null);
    setRetryNotice(null);
    let requeued = 1;
    let failure: string | null = null;

    if (target === 'all') {
      const result = await retryFailedQueueItems(job.id);
      if (result.ok) requeued = result.data.length;
      else failure = result.error;
    } else {
      const result = await retryQueueItem(target);
      if (!result.ok) failure = result.error;
    }
    setRetrying(null);

    if (failure !== null) {
      setRetryError(failure);
      return;
    }

    setRetryNotice(
      `Requeued ${requeued} ${requeued === 1 ? 'directory' : 'directories'}; each gets one more attempt.`,
    );
    router.refresh();
  }

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href={`/exodus/sources/${job.sourceId}`}
          color="secondary"
          size="small"
          className="self-start"
        >
          ← {sourceName ?? 'Source'}
        </OutlinedButton>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h1" component="h1" className="break-all">
            {job.rootPath}
          </Typography>
          <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <Typography variant="caption" className="text-neutral-400">
              Source
            </Typography>
            <Typography variant="body2">
              {sourceName ? (
                <Link
                  href={`/exodus/sources/${job.sourceId}`}
                  className="text-primary-400 hover:underline"
                >
                  {sourceName}
                </Link>
              ) : (
                'Unknown source'
              )}
            </Typography>
          </div>
          <Detail title="Created">
            <LocalDateTime iso={job.createdAt} />
          </Detail>
          <Detail title="Progress">
            <JobProgress job={job} />
          </Detail>
          {active && (
            <Detail title="Last activity">
              <JobActivity job={job} />
            </Detail>
          )}
          {active && job.staleClaims > 0 && (
            <Detail title="Expired leases">{job.staleClaims}</Detail>
          )}
          <Detail title="Finished">
            <LocalDateTime iso={job.finishedAt} />
          </Detail>
          <Detail title="Duration">
            {formatDuration(job.createdAt, job.finishedAt)}
          </Detail>
        </div>
        {job.error && (
          <Typography variant="body2" className="text-error-400">
            {job.error}
          </Typography>
        )}
      </div>

      {phase && (
        <Panel color="default" className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <Badge color={phase.color}>{phase.label}</Badge>
            <Typography variant="body2">{phase.detail}</Typography>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_FILTERS.map(({ status: s, label }) => (
          <CountTile
            key={s}
            label={label}
            value={job.queueCounts[s]}
            color={QUEUE_STATUS_COLOR[s]}
          />
        ))}
      </div>

      {active && (
        <QueueDirectoriesModal
          open={queueing}
          onOpenChange={setQueueing}
          jobId={job.id}
          rootPath={job.rootPath}
          onQueued={() => router.refresh()}
        />
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography variant="h5" component="h2">
            Directories
          </Typography>
          <div className="flex flex-wrap gap-2">
            {active && (
              <OutlinedButton
                size="small"
                color="primary"
                onClick={() => setQueueing(true)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="plus" size={14} />
                  Queue directories
                </span>
              </OutlinedButton>
            )}
            {active && job.queueCounts.failed > 0 && (
              <OutlinedButton
                size="small"
                color="warning"
                disabled={retrying !== null}
                onClick={() => void retry('all')}
              >
                {retrying === 'all'
                  ? 'Retrying…'
                  : `Retry all failed (${job.queueCounts.failed})`}
              </OutlinedButton>
            )}
            <TransparentPanel
              color="dark"
              className="flex flex-wrap items-center gap-2"
            >
              <OutlinedButton
                component={Link}
                href={jobDetailUrl(job.id)}
                size="small"
                color={status === null ? 'primary' : 'secondary'}
              >
                All
              </OutlinedButton>
              {STATUS_FILTERS.map(({ status: s, label }) => (
                <OutlinedButton
                  key={s}
                  component={Link}
                  href={jobDetailUrl(job.id, s)}
                  size="small"
                  color={status === s ? 'primary' : 'secondary'}
                >
                  {label}
                </OutlinedButton>
              ))}
            </TransparentPanel>
          </div>
        </div>

        {retryError && (
          <Typography variant="body2" className="text-error-400">
            {retryError}
          </Typography>
        )}
        {retryNotice && (
          <Typography
            variant="body2"
            role="status"
            className="text-success-400"
          >
            {retryNotice}
          </Typography>
        )}
        {sortedItems === null ? (
          <Typography variant="body2" className="text-error-400">
            Failed to load directories from homelab-api.
          </Typography>
        ) : sortedItems.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            No directories{status ? ` with status ${status}` : ''}.
          </Typography>
        ) : (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th className="w-px px-2">
                      <span className="sr-only">Skips reviewed</span>
                    </Th>
                    <Th>Path</Th>
                    <Th>Status</Th>
                    <Th>Skipped</Th>
                    <Th>Inventory</Th>
                    <Th>Attempts</Th>
                    <Th>Lease</Th>
                    <Th>Last error</Th>
                    <Th>Completed</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id}>
                      <Td className="w-px px-2">
                        <ReviewedMark reviewed={item.skipsReviewed} />
                      </Td>
                      <Td>
                        <Link
                          href={directoryDetailUrl(job.id, item.id)}
                          className="break-all text-primary-400 hover:underline"
                        >
                          {item.path}
                        </Link>
                      </Td>
                      <Td>
                        <Tooltip
                          content={QUEUE_STATUS_DESCRIPTION[item.status]}
                        >
                          <span className="inline-flex">
                            <Badge color={QUEUE_STATUS_COLOR[item.status]}>
                              {item.status}
                            </Badge>
                          </span>
                        </Tooltip>
                      </Td>
                      <Td>{describeSkips(item.result) || '—'}</Td>
                      <Td>{item.inventoryCount || '—'}</Td>
                      <Td>
                        {item.attemptCount} / {item.maxAttempts}
                      </Td>
                      <Td>
                        {item.leaseExpiresAt ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <LocalDateTime iso={item.leaseExpiresAt} seconds />
                            {now !== null && isStaleClaim(item, now) && (
                              <Badge color="error">expired</Badge>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-2">
                          <QueueItemMessage lastError={item.lastError} clamp />
                          {active && item.status === 'failed' && (
                            <OutlinedButton
                              size="small"
                              color="warning"
                              disabled={retrying !== null}
                              onClick={() => void retry(item.id)}
                            >
                              {retrying === item.id ? 'Retrying…' : 'Retry'}
                            </OutlinedButton>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <LocalDateTime iso={item.completedAt} />
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>

            {sortedItems.length >= JOB_QUEUE_ITEMS_LIMIT && (
              <Typography variant="body2" className="text-warning-400">
                Showing the {JOB_QUEUE_ITEMS_LIMIT} most recently changed
                directories, sorted by path. Filter by status to narrow it down.
              </Typography>
            )}
          </>
        )}
      </section>
    </main>
  );
}
