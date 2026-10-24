'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Fragment,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Icon } from '@abbottland/fui-icons';
import {
  Badge,
  Button,
  Input,
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
  JOB_STATUS_COLOR,
  QUEUE_STATUS_COLOR,
  describeSkips,
  formatDuration,
  jobDetailUrl,
  parsePathLines,
  relativeToDirectory,
} from '../../lib/job-display';
import { LocalDateTime } from '../../lib/LocalDateTime';
import { CountTile } from '../../sources/[id]/CountTile';
import { PromoteSkippedModal } from './PromoteSkippedModal';
import {
  enqueueQueueItems,
  listInventoryPathsUnder,
} from '../../sources/lib/actions';
import {
  JOB_QUEUE_ITEMS_LIMIT,
  isActiveJob,
  type DiscoveryJobWithCounts,
  type QueueItem,
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

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Typography variant="body1" className="text-neutral-400">
        {title}
      </Typography>
      <Typography variant="body2" className="break-words">
        {children}
      </Typography>
    </div>
  );
}

function QueueItemDetails({
  item,
  sourceId,
}: {
  item: QueueItem;
  sourceId: string;
}) {
  const result = item.result;
  const hasNothing = !item.reason && !result && !item.lastError;
  // Lowercased paths already in the inventory beneath this directory.
  const [inventoried, setInventoried] = useState<ReadonlySet<string>>(
    new Set(),
  );
  // `path` is absent when the user types one in.
  const [promoting, setPromoting] = useState<{
    path?: string;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    if (!result) return;

    let cancelled = false;
    void listInventoryPathsUnder(sourceId, item.path).then((found) => {
      if (!cancelled && found.ok) setInventoried(new Set(found.data));
    });

    return () => {
      cancelled = true;
    };
  }, [sourceId, item.path, result]);

  return (
    <div className="flex flex-col gap-3">
      {item.reason && <Detail title="Why it was queued">{item.reason}</Detail>}
      {result?.summary && (
        <Detail title="What the agent concluded">{result.summary}</Detail>
      )}
      {item.lastError && <Detail title="Last error">{item.lastError}</Detail>}

      {result?.skippedGroups && result.skippedGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <Typography variant="body1" className="text-neutral-400">
            Skipped by pattern
          </Typography>
          <ScrollableTable className="mb-0">
            <Table size="small" color="secondary">
              <TableHead>
                <TableRow>
                  <Th color="secondary">Pattern</Th>
                  <Th color="secondary">Count</Th>
                  <Th color="secondary">Reason</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.skippedGroups.map((group) => (
                  <TableRow key={group.pattern}>
                    <Td color="secondary" className="break-all">
                      {group.pattern}
                    </Td>
                    <Td color="secondary" className="text-neutral-400">
                      {group.count ?? '—'}
                    </Td>
                    <Td color="secondary" className="text-neutral-400">
                      {group.reason}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        </div>
      )}

      {result && result.skipped.length > 0 && (
        <div className="flex flex-col gap-1">
          <Typography variant="body1" className="text-neutral-400">
            Skipped paths
          </Typography>
          <ScrollableTable className="mb-0">
            <Table size="small" color="secondary">
              <TableHead>
                <TableRow>
                  <Th color="secondary">Inventory</Th>
                  <Th color="secondary">Path</Th>
                  <Th color="secondary">Reason</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.skipped.map((skip) => (
                  <TableRow key={skip.path}>
                    <Td color="secondary">
                      {inventoried.has(skip.path.toLowerCase()) ? (
                        <Link
                          href="/exodus/inventory"
                          className="text-neutral-400 underline"
                        >
                          In inventory
                        </Link>
                      ) : (
                        <OutlinedButton
                          size="small"
                          color="secondary"
                          onClick={() =>
                            setPromoting({
                              path: skip.path,
                              reason: skip.reason,
                            })
                          }
                        >
                          Promote
                        </OutlinedButton>
                      )}
                    </Td>
                    <Td color="secondary" className="break-all">
                      {relativeToDirectory(item.path, skip.path)}
                    </Td>
                    <Td color="secondary" className="text-neutral-400">
                      {skip.reason}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTable>
        </div>
      )}

      {result && (
        <div>
          <OutlinedButton
            size="small"
            color="secondary"
            onClick={() => setPromoting({})}
          >
            Promote a path…
          </OutlinedButton>
        </div>
      )}

      {promoting && (
        <PromoteSkippedModal
          key={promoting.path ?? 'typed'}
          open
          onOpenChange={(next) => {
            if (!next) setPromoting(null);
          }}
          queueItem={item}
          path={promoting.path}
          skipReason={promoting.reason}
          onPromoted={(path) =>
            setInventoried((current) =>
              new Set(current).add(path.toLowerCase()),
            )
          }
        />
      )}

      {hasNothing && (
        <Typography variant="body2" className="text-neutral-400">
          Nothing recorded for this directory yet.
        </Typography>
      )}
    </div>
  );
}

function QueueDirectoryPanel({
  jobId,
  rootPath,
  onQueued,
}: {
  jobId: string;
  rootPath: string;
  onQueued: () => void;
}) {
  const [paths, setPaths] = useState('');
  const [priority, setPriority] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const result = await enqueueQueueItems(
      jobId,
      parsePathLines(paths),
      priority.trim() === '' ? undefined : Number(priority),
    );
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const created = result.data.filter((r) => r.created).length;
    const already = result.data.length - created;
    setMessage(
      `Queued ${created} ${created === 1 ? 'directory' : 'directories'}` +
        (already > 0 ? `, ${already} already in this job` : ''),
    );
    setPaths('');
    onQueued();
  }

  return (
    <Panel color="default" className="flex flex-col gap-4">
      <Typography variant="h5" component="h2">
        Queue Directories
      </Typography>
      <Typography variant="body2" className="text-neutral-400">
        Point the agent at more places inside this job&apos;s root ({rootPath}).
        One path per line. Paths under an exclusion rule are skipped
        immediately.
      </Typography>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <Typography variant="body2" className="text-neutral-400">
            Paths
          </Typography>
          <textarea
            required
            rows={3}
            value={paths}
            onChange={(e) => setPaths(e.target.value)}
            placeholder={`${rootPath}\\Archive`}
            className="border border-neutral-300 bg-neutral-600 px-2 py-1.5 text-neutral-50 focus:outline-none focus:ring-0"
          />
        </label>
        <label className="flex flex-col gap-1 sm:w-48">
          <Typography variant="body2" className="text-neutral-400">
            Priority (optional, higher first)
          </Typography>
          <Input
            type="number"
            step={1}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="0"
          />
        </label>

        {error && (
          <Typography variant="body2" className="text-error-400">
            {error}
          </Typography>
        )}
        {message && <Typography variant="body2">{message}</Typography>}

        <Button
          type="submit"
          size="small"
          className="self-start"
          disabled={submitting || parsePathLines(paths).length === 0}
        >
          {submitting ? 'Queueing…' : 'Queue'}
        </Button>
      </form>
    </Panel>
  );
}

interface JobDetailClientProps {
  job: DiscoveryJobWithCounts;
  /** Null if the sources could not be loaded. */
  sourceName: string | null;
  /** Null if the queue items could not be loaded. */
  items: QueueItem[] | null;
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const active = isActiveJob(job);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);

      return next;
    });
  }

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href="/exodus/jobs"
          color="secondary"
          size="small"
          className="self-start"
        >
          ← Jobs
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_FILTERS.map(({ status: s, label }) => (
          <CountTile key={s} label={label} value={job.queueCounts[s]} />
        ))}
      </div>

      {active && (
        <QueueDirectoryPanel
          jobId={job.id}
          rootPath={job.rootPath}
          onQueued={() => router.refresh()}
        />
      )}

      <Panel color="default" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography variant="h5" component="h2">
            Directories
          </Typography>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>

        {items === null ? (
          <Typography variant="body2" className="text-error-400">
            Failed to load directories from homelab-api.
          </Typography>
        ) : items.length === 0 ? (
          <Typography variant="body2" className="text-neutral-400">
            No directories{status ? ` with status ${status}` : ''}.
          </Typography>
        ) : (
          <>
            <ScrollableTable className="mb-0">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <Th>Path</Th>
                    <Th>Status</Th>
                    <Th>Skipped</Th>
                    <Th>Attempts</Th>
                    <Th>Completed</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <Fragment key={item.id}>
                      <TableRow>
                        <Td>
                          <div className="flex items-start gap-2">
                            <OutlinedButton
                              size="small"
                              color="secondary"
                              aria-expanded={expanded.has(item.id)}
                              aria-label={
                                expanded.has(item.id)
                                  ? 'Hide details'
                                  : 'Show details'
                              }
                              onClick={() => toggle(item.id)}
                              className="shrink-0 px-1.5"
                            >
                              <Icon
                                name={
                                  expanded.has(item.id)
                                    ? 'radix-chevron-down'
                                    : 'radix-chevron-right'
                                }
                                size={14}
                              />
                            </OutlinedButton>
                            <span className="break-all">{item.path}</span>
                          </div>
                        </Td>
                        <Td>
                          <Badge color={QUEUE_STATUS_COLOR[item.status]}>
                            {item.status}
                          </Badge>
                        </Td>
                        <Td>{describeSkips(item.result) || '—'}</Td>
                        <Td>
                          {item.attemptCount} / {item.maxAttempts}
                        </Td>
                        <Td>
                          <LocalDateTime iso={item.completedAt} />
                        </Td>
                      </TableRow>
                      {expanded.has(item.id) && (
                        <TableRow>
                          <Td colSpan={5}>
                            <QueueItemDetails
                              item={item}
                              sourceId={job.sourceId}
                            />
                          </Td>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>

            {items.length >= JOB_QUEUE_ITEMS_LIMIT && (
              <Typography variant="body2" className="text-warning-400">
                Showing the first {JOB_QUEUE_ITEMS_LIMIT} directories, oldest
                first. Filter by status to narrow it down.
              </Typography>
            )}
          </>
        )}
      </Panel>
    </main>
  );
}
