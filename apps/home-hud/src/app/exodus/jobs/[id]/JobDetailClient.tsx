'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Fragment,
  useEffect,
  useMemo,
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
  comparePaths,
  describeSkips,
  formatDuration,
  isStaleClaim,
  jobDetailUrl,
  jobPhase,
  parsePathLines,
  relativeToDirectory,
} from '../../lib/job-display';
import {
  JobActivity,
  JobProgress,
  QueueItemMessage,
  WorkerName,
} from '../../lib/JobSummary';
import { LocalDateTime } from '../../lib/LocalDateTime';
import { CountTile } from '../../sources/[id]/CountTile';
import { PatternMatchesModal } from '../../lib/PatternMatchesModal';
import { PreviewButton } from '../../lib/PreviewButton';
import { InventoryDirectoryModal } from './InventoryDirectoryModal';
import { PromoteSkippedModal } from './PromoteSkippedModal';
import {
  acknowledgeSkip,
  enqueueQueueItems,
  listAcknowledgedSkipsUnder,
  listInventoryPathsUnder,
  retryFailedQueueItems,
  retryQueueItem,
  unacknowledgeSkip,
} from '../../sources/lib/actions';
import {
  JOB_QUEUE_ITEMS_LIMIT,
  isActiveJob,
  type DiscoveryJobWithCounts,
  type QueueItem,
  type QueueItemStatus,
  skipKey,
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

/** Copies `text`; clipboard access can be denied (insecure origin, no permission), so failure is shown, not thrown. */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <OutlinedButton size="small" color="secondary" onClick={() => void copy()}>
      {state === 'copied'
        ? 'Copied'
        : state === 'failed'
          ? 'Copy failed'
          : 'Copy'}
    </OutlinedButton>
  );
}

/** The button that marks a skip as reviewed, or takes that back. */
function AcknowledgeControl({
  acknowledged,
  onAcknowledge,
  onUndo,
}: {
  acknowledged: boolean;
  onAcknowledge: () => void;
  onUndo: () => void;
}) {
  if (acknowledged) {
    return (
      <OutlinedButton size="small" color="warning" onClick={onUndo}>
        Undo ack
      </OutlinedButton>
    );
  }

  return (
    <OutlinedButton size="small" color="success" onClick={onAcknowledge}>
      Acknowledge
    </OutlinedButton>
  );
}

/** What a human has done about the skips beneath a job's root, shared by the list and the open rows. */
interface SkipReview {
  /** Lowercased paths already in the inventory. */
  inventoried: ReadonlySet<string>;
  /** Lowercased paths of approved inventory items: the human has taken them whole. */
  approved: ReadonlySet<string>;
  /** `skipKey`s of the acknowledged skips. */
  acknowledged: ReadonlySet<string>;
  /** Null on success, else the error to show. */
  setReviewed: (
    queueItemId: string,
    path: string,
    pattern: string,
    reviewed: boolean,
  ) => Promise<string | null>;
  markInventoried: (path: string) => void;
  /** Also marks the path as taken whole. */
  markApproved: (path: string) => void;
}

function useSkipReview(
  sourceId: string,
  rootPath: string,
  items: QueueItem[] | null,
): SkipReview {
  const [inventoried, setInventoried] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // `items` is a fresh array on every server refresh, so new skips are picked up.
  useEffect(() => {
    let cancelled = false;
    void listInventoryPathsUnder(sourceId, rootPath).then((found) => {
      if (!cancelled && found.ok) setInventoried(new Set(found.data));
    });
    void listInventoryPathsUnder(sourceId, rootPath, true).then((found) => {
      if (!cancelled && found.ok) setApproved(new Set(found.data));
    });
    void listAcknowledgedSkipsUnder(sourceId, rootPath).then((found) => {
      if (!cancelled && found.ok) setAcknowledged(new Set(found.data));
    });

    return () => {
      cancelled = true;
    };
  }, [sourceId, rootPath, items]);

  async function setReviewed(
    queueItemId: string,
    path: string,
    pattern: string,
    reviewed: boolean,
  ) {
    const input = { path, ...(pattern ? { pattern } : {}) };
    const res = reviewed
      ? await acknowledgeSkip(queueItemId, input)
      : await unacknowledgeSkip(queueItemId, input);

    if (!res.ok) return res.error;

    setAcknowledged((current) => {
      const next = new Set(current);
      const key = skipKey(path, pattern);
      if (reviewed) next.add(key);
      else next.delete(key);

      return next;
    });

    return null;
  }

  return {
    inventoried,
    approved,
    acknowledged,
    setReviewed,
    markInventoried: (path) =>
      setInventoried((current) => new Set(current).add(path.toLowerCase())),
    markApproved: (path) => {
      setInventoried((current) => new Set(current).add(path.toLowerCase()));
      setApproved((current) => new Set(current).add(path.toLowerCase()));
    },
  };
}

/**
 * Whether a human has dealt with every skip of a directory. Null when the
 * directory has no result yet (not completed), so nothing can be said.
 * Promoted paths count as reviewed: the human acted on them.
 */
function skipsReviewed(
  item: QueueItem,
  { acknowledged, inventoried }: SkipReview,
): boolean | null {
  if (!item.result) return null;

  return (
    item.result.skipped.every(
      (skip) =>
        acknowledged.has(skipKey(skip.path)) ||
        inventoried.has(skip.path.toLowerCase()),
    ) &&
    (item.result.skippedGroups ?? []).every((group) =>
      acknowledged.has(skipKey(item.path, group.pattern)),
    )
  );
}

/** A check when every skip is dealt with (or there are none), a flag when some are not, nothing when unknown. */
function ReviewedMark({ reviewed }: { reviewed: boolean | null }) {
  if (reviewed === null) return null;

  return reviewed ? (
    <Icon
      name="radix-check"
      size={16}
      className="text-success-400"
      title="All skips reviewed"
    />
  ) : (
    <Icon
      name="radix-warning"
      size={16}
      className="text-warning-400"
      title="Skips still to review"
    />
  );
}

function QueueItemDetails({
  item,
  sourceId,
  review,
  onInventoried,
}: {
  item: QueueItem;
  sourceId: string;
  review: SkipReview;
  /** After the whole directory was added: refresh the queue and say what happened. */
  onInventoried: (path: string, skippedQueueItems: number) => void;
}) {
  const result = item.result;
  const hasNothing = !item.reason && !result && !item.lastError;
  const { inventoried, acknowledged } = review;
  const [ackError, setAckError] = useState<string | null>(null);
  // `path` is absent when the user types one in.
  const [promoting, setPromoting] = useState<{
    path?: string;
    reason?: string;
  } | null>(null);
  const approved = review.approved.has(item.path.toLowerCase());
  const [inventoryingDirectory, setInventoryingDirectory] = useState(false);
  const [viewingPattern, setViewingPattern] = useState<{
    pattern: string;
    count?: number;
    reason: string;
  } | null>(null);

  async function setReviewed(path: string, pattern: string, reviewed: boolean) {
    setAckError(await review.setReviewed(item.id, path, pattern, reviewed));
  }

  const skippedPaths = result?.skipped ?? [];
  const skippedGroups = result?.skippedGroups ?? [];
  // Promoted paths are reviewed too: the human acted on them.
  const reviewedPaths = skippedPaths.filter(
    (skip) =>
      acknowledged.has(skipKey(skip.path)) ||
      inventoried.has(skip.path.toLowerCase()),
  ).length;
  const reviewedGroups = skippedGroups.filter((group) =>
    acknowledged.has(skipKey(item.path, group.pattern)),
  ).length;

  return (
    <div className="flex flex-col gap-3">
      {item.reason && <Detail title="Why it was queued">{item.reason}</Detail>}
      {result?.summary && (
        <Detail title="What the agent concluded">{result.summary}</Detail>
      )}
      {item.lastError && (
        <Detail title="Last error">
          <span className="flex flex-wrap items-start gap-3">
            <QueueItemMessage lastError={item.lastError} />
            <CopyButton text={item.lastError} />
          </span>
        </Detail>
      )}

      {result?.skippedGroups && result.skippedGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <Typography variant="body1" className="text-neutral-400">
            Skipped by pattern · {reviewedGroups} / {skippedGroups.length}{' '}
            reviewed
          </Typography>
          <ScrollableTable className="mb-0">
            <Table size="small" color="secondary">
              <TableHead>
                <TableRow>
                  <Th color="secondary">Review</Th>
                  <Th color="secondary">Pattern</Th>
                  <Th color="secondary">Count</Th>
                  <Th color="secondary">Reason</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.skippedGroups.map((group) => (
                  <TableRow key={group.pattern}>
                    <Td color="secondary">
                      <AcknowledgeControl
                        acknowledged={acknowledged.has(
                          skipKey(item.path, group.pattern),
                        )}
                        onAcknowledge={() =>
                          void setReviewed(item.path, group.pattern, true)
                        }
                        onUndo={() =>
                          void setReviewed(item.path, group.pattern, false)
                        }
                      />
                    </Td>
                    <Td color="secondary" className="break-all">
                      <button
                        type="button"
                        title="Show the files this pattern matched"
                        onClick={() => setViewingPattern(group)}
                        className="text-left underline decoration-dotted hover:text-primary-400"
                      >
                        {group.pattern}
                      </button>
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
            Skipped paths · {reviewedPaths} / {skippedPaths.length} reviewed
          </Typography>
          {ackError && (
            <Typography variant="body2" className="text-error-400">
              {ackError}
            </Typography>
          )}
          <ScrollableTable className="mb-0">
            <Table size="small" color="secondary">
              <TableHead>
                <TableRow>
                  <Th color="secondary">Review</Th>
                  <Th color="secondary">Path</Th>
                  <Th color="secondary">Reason</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.skipped.map((skip) => (
                  <TableRow key={skip.path}>
                    <Td color="secondary">
                      <div className="flex flex-wrap items-center gap-2">
                        {inventoried.has(skip.path.toLowerCase()) ? (
                          <Link
                            href="/exodus/inventory"
                            className="text-neutral-400 underline"
                          >
                            In inventory
                          </Link>
                        ) : (
                          <>
                            <AcknowledgeControl
                              acknowledged={acknowledged.has(
                                skipKey(skip.path),
                              )}
                              onAcknowledge={() =>
                                void setReviewed(skip.path, '', true)
                              }
                              onUndo={() =>
                                void setReviewed(skip.path, '', false)
                              }
                            />
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
                          </>
                        )}
                      </div>
                    </Td>
                    <Td color="secondary" className="break-all">
                      <div className="flex items-center gap-2">
                        <PreviewButton sourceId={sourceId} path={skip.path} />
                        <span>{relativeToDirectory(item.path, skip.path)}</span>
                      </div>
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

      <div className="flex flex-wrap items-center gap-2">
        {approved && (
          <Link href="/exodus/inventory" className="text-neutral-400 underline">
            Directory approved in inventory
          </Link>
        )}
        <OutlinedButton
          size="small"
          color="success"
          onClick={() => setInventoryingDirectory(true)}
        >
          {approved
            ? 'Skip queued subdirectories'
            : 'Inventory whole directory'}
        </OutlinedButton>
        {result && (
          <OutlinedButton
            size="small"
            color="secondary"
            onClick={() => setPromoting({})}
          >
            Promote a path…
          </OutlinedButton>
        )}
      </div>

      {inventoryingDirectory && (
        <InventoryDirectoryModal
          open
          onOpenChange={setInventoryingDirectory}
          queueItem={item}
          onInventoried={(path, skipped) => {
            review.markApproved(path);
            onInventoried(path, skipped);
          }}
        />
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
          onPromoted={review.markInventoried}
        />
      )}

      {viewingPattern && (
        <PatternMatchesModal
          key={viewingPattern.pattern}
          open
          onOpenChange={(next) => {
            if (!next) setViewingPattern(null);
          }}
          sourceId={sourceId}
          queueItem={item}
          pattern={viewingPattern.pattern}
          expectedCount={viewingPattern.count}
          reason={viewingPattern.reason}
          inventoried={inventoried}
          onPromoted={review.markInventoried}
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
  const review = useSkipReview(job.sourceId, job.rootPath, items);
  const sortedItems = useMemo(
    () =>
      items ? [...items].sort((a, b) => comparePaths(a.path, b.path)) : null,
    [items],
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const active = isActiveJob(job);
  const [now, setNow] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<string | 'all' | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

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

  // A refresh can add rows or change a row's status under the reader; hold
  // it still while any row is open.
  const paused = expanded.size > 0;

  useEffect(() => {
    if (!active || paused) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, paused, router]);

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

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography variant="h5" component="h2">
            Directories
          </Typography>
          <div className="flex flex-wrap gap-2">
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
        {inventoryNotice && (
          <Typography
            variant="body2"
            role="status"
            className="text-success-400"
          >
            {inventoryNotice}
          </Typography>
        )}
        {active && expanded.size > 0 && (
          <Typography variant="body2" className="text-neutral-400">
            Auto-refresh is paused while a directory is open. Close it to
            resume.
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
                    <Th>Attempts</Th>
                    <Th>Worker</Th>
                    <Th>Lease</Th>
                    <Th>Last error</Th>
                    <Th>Completed</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.map((item) => (
                    <Fragment key={item.id}>
                      <TableRow>
                        <Td className="w-px px-2">
                          <ReviewedMark
                            reviewed={skipsReviewed(item, review)}
                          />
                        </Td>
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
                          {item.claimedBy ? (
                            <WorkerName name={item.claimedBy} />
                          ) : item.lastClaimedBy ? (
                            <span className="text-neutral-400">
                              <WorkerName name={item.lastClaimedBy} />
                            </span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td>
                          {item.leaseExpiresAt ? (
                            <span className="flex flex-wrap items-center gap-2">
                              <LocalDateTime
                                iso={item.leaseExpiresAt}
                                seconds
                              />
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
                            <QueueItemMessage
                              lastError={item.lastError}
                              clamp
                            />
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
                      {expanded.has(item.id) && (
                        <TableRow>
                          <Td colSpan={9}>
                            <QueueItemDetails
                              item={item}
                              sourceId={job.sourceId}
                              review={review}
                              onInventoried={(path, skipped) => {
                                setInventoryNotice(
                                  `Added ${path} to the inventory; ${skipped} queued ${skipped === 1 ? 'directory' : 'directories'} inside it skipped.`,
                                );
                                router.refresh();
                              }}
                            />
                          </Td>
                        </TableRow>
                      )}
                    </Fragment>
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
