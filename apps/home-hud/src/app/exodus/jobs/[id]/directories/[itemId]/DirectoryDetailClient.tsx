'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
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
  Typography,
} from '@abbottland/fui-components';
import {
  QUEUE_STATUS_COLOR,
  QUEUE_STATUS_DESCRIPTION,
  comparePaths,
  isStaleClaim,
  jobDetailUrl,
  relativeToDirectory,
} from '../../../../lib/job-display';
import { QueueItemMessage } from '../../../../lib/JobSummary';
import {
  AcknowledgeControl,
  CopyButton,
  Detail,
  ReviewedMark,
} from '../../../../lib/DirectoryReview';
import {
  DECISION_COLOR,
  DECISION_LABELS,
  RECOMMENDATION_COLOR,
  RECOMMENDATION_LABELS,
  inventoryItemUrl,
} from '../../../../lib/inventory-display';
import { LocalDateTime } from '../../../../lib/LocalDateTime';
import { PatternMatchesModal } from '../../../../lib/PatternMatchesModal';
import { PreviewButton } from '../../../../lib/PreviewButton';
import { PromoteSkippedModal } from '../../../../lib/PromoteSkippedModal';
import { InventoryDirectoryModal } from './InventoryDirectoryModal';
import { OnDiskSection } from './OnDiskSection';
import {
  acknowledgeSkip,
  retryQueueItem,
  unacknowledgeSkip,
} from '../../../../sources/lib/actions';
import {
  isActiveJob,
  type InventoryItem,
  type QueueItemDetail,
} from '../../../../sources/lib/homelab-api';

/** While the directory may still change under the agent's hands the page re-fetches this often. */
const ACTIVE_REFRESH_MS = 5000;

function Section({
  title,
  empty,
  children,
}: {
  title: ReactNode;
  /** Shown instead of `children` when set. */
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {empty ? (
        <Typography variant="body2" className="text-neutral-400">
          {empty}
        </Typography>
      ) : (
        children
      )}
    </section>
  );
}

interface DirectoryDetailClientProps {
  item: QueueItemDetail;
  /** Null if the sources could not be loaded. */
  sourceName: string | null;
  /** Null if the inventory items could not be loaded. */
  inventoryItems: InventoryItem[] | null;
  /** Normalized paths already in the inventory beneath this directory. */
  inventoriedPaths: string[];
}

export function DirectoryDetailClient({
  item,
  sourceName,
  inventoryItems,
  inventoriedPaths,
}: DirectoryDetailClientProps) {
  const router = useRouter();
  const { job, skipReview, directoryApproved } = item;
  const sourceId = job.sourceId;
  const result = item.result;
  const active = isActiveJob(job);
  const [now, setNow] = useState<number | null>(null);
  // Acknowledge/undo in flight, as `path|pattern`.
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // `path` is absent when the user types one in.
  const [promoting, setPromoting] = useState<{
    path?: string;
    reason?: string;
  } | null>(null);
  const [inventoryingDirectory, setInventoryingDirectory] = useState(false);
  const [viewingPattern, setViewingPattern] = useState<{
    pattern: string;
    count?: number;
    reason: string;
  } | null>(null);

  // Only a directory still being worked on changes by itself.
  const settling = item.status === 'queued' || item.status === 'in_progress';

  useEffect(() => {
    if (!active || !settling) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, settling, router]);

  // Set after mount: lease expiry compared against the server's clock at render
  // time would not match what the browser computes during hydration.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);

    return () => clearTimeout(timer);
  }, [item]);

  async function setReviewed(path: string, pattern: string, reviewed: boolean) {
    const input = { path, ...(pattern ? { pattern } : {}) };
    setPending(`${path}|${pattern}`);
    setActionError(null);
    const res = reviewed
      ? await acknowledgeSkip(item.id, input)
      : await unacknowledgeSkip(item.id, input);
    setPending(null);

    if (!res.ok) {
      setActionError(res.error);
      return;
    }

    router.refresh();
  }

  async function retry() {
    setRetrying(true);
    setActionError(null);
    const res = await retryQueueItem(item.id);
    setRetrying(false);

    if (!res.ok) {
      setActionError(res.error);
      return;
    }

    setNotice('Requeued; the directory gets one more attempt.');
    router.refresh();
  }

  const skippedPaths = result?.skipped ?? [];
  const skippedGroups = result?.skippedGroups ?? [];
  const reviewedPaths = skipReview.paths.filter(
    (p) => p.acknowledged || p.inventoried,
  ).length;
  const reviewedGroups = skipReview.patterns.filter(
    (p) => p.acknowledged,
  ).length;
  const sortedInventory = [...(inventoryItems ?? [])].sort((a, b) =>
    comparePaths(a.rootPath, b.rootPath),
  );

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href={jobDetailUrl(job.id)}
          color="secondary"
          size="small"
          className="self-start"
        >
          ← Back to job
        </OutlinedButton>
        <Typography variant="caption" className="text-neutral-400">
          Directory
        </Typography>
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h1" component="h1" className="break-all">
            {item.path}
          </Typography>
          <Tooltip content={QUEUE_STATUS_DESCRIPTION[item.status]}>
            <span className="inline-flex">
              <Badge color={QUEUE_STATUS_COLOR[item.status]}>
                {item.status}
              </Badge>
            </span>
          </Tooltip>
          <ReviewedMark reviewed={item.reviewed} />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Detail title="Source">
            {sourceName ? (
              <Link
                href={`/exodus/sources/${sourceId}`}
                className="text-primary-400 hover:underline"
              >
                {sourceName}
              </Link>
            ) : (
              'Unknown source'
            )}
          </Detail>
          <Detail title="Job root">
            <Link
              href={jobDetailUrl(job.id)}
              className="break-all text-primary-400 hover:underline"
            >
              {job.rootPath}
            </Link>
          </Detail>
          <Detail title="Attempts">
            {item.attemptCount} / {item.maxAttempts}
          </Detail>
          {item.leaseExpiresAt && (
            <Detail title="Lease">
              <span className="flex flex-wrap items-center gap-2">
                <LocalDateTime iso={item.leaseExpiresAt} seconds />
                {now !== null && isStaleClaim(item, now) && (
                  <Badge color="error">expired</Badge>
                )}
              </span>
            </Detail>
          )}
          <Detail title="Completed">
            <LocalDateTime iso={item.completedAt} />
          </Detail>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {directoryApproved && (
          <Link
            href={inventoryItemUrl(sourceId, item.path)}
            className="text-neutral-400 underline"
          >
            Directory approved in inventory
          </Link>
        )}
        <OutlinedButton
          size="small"
          color="success"
          onClick={() => setInventoryingDirectory(true)}
        >
          {directoryApproved
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
        {active && item.status === 'failed' && (
          <OutlinedButton
            size="small"
            color="warning"
            disabled={retrying}
            onClick={() => void retry()}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </OutlinedButton>
        )}
      </div>

      {actionError && (
        <Typography variant="body2" className="text-error-400">
          {actionError}
        </Typography>
      )}
      {notice && (
        <Typography variant="body2" role="status" className="text-success-400">
          {notice}
        </Typography>
      )}

      <Panel color="default" className="flex flex-col gap-3">
        <Detail title="Why it was queued">{item.reason ?? '—'}</Detail>
        <Detail title="What the agent concluded">
          {result?.summary ?? '—'}
        </Detail>
        <Detail title="Last error">
          {item.lastError ? (
            <span className="flex flex-wrap items-start gap-3">
              <QueueItemMessage lastError={item.lastError} />
              <CopyButton text={item.lastError} />
            </span>
          ) : (
            '—'
          )}
        </Detail>
      </Panel>

      <Section
        title={
          <>
            Skipped by pattern · {reviewedGroups} / {skippedGroups.length}{' '}
            reviewed
          </>
        }
        empty={
          !result
            ? 'Not explored yet.'
            : skippedGroups.length === 0
              ? 'None.'
              : undefined
        }
      >
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
              {skippedGroups.map((group, i) => (
                <TableRow key={group.pattern}>
                  <Td color="secondary">
                    <AcknowledgeControl
                      acknowledged={
                        skipReview.patterns[i]?.acknowledged ?? false
                      }
                      disabled={pending !== null}
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
      </Section>

      <Section
        title={
          <>
            Skipped paths · {reviewedPaths} / {skippedPaths.length} reviewed
          </>
        }
        empty={
          !result
            ? 'Not explored yet.'
            : skippedPaths.length === 0
              ? 'None.'
              : undefined
        }
      >
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
              {skippedPaths.map((skip, i) => (
                <TableRow key={skip.path}>
                  <Td color="secondary">
                    <div className="flex flex-wrap items-center gap-2">
                      {skipReview.paths[i]?.inventoried ? (
                        <Link
                          href={inventoryItemUrl(sourceId, skip.path)}
                          className="text-neutral-400 underline"
                        >
                          In inventory
                        </Link>
                      ) : (
                        <>
                          <AcknowledgeControl
                            acknowledged={
                              skipReview.paths[i]?.acknowledged ?? false
                            }
                            disabled={pending !== null}
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
      </Section>

      <OnDiskSection
        sourceId={sourceId}
        queueItemId={item.id}
        coverageSignature={JSON.stringify([
          skipReview,
          item.inventoryByDecision,
          directoryApproved,
        ])}
        onPromote={(path) => setPromoting({ path })}
      />

      <Section
        title={<>Inventory items · {sortedInventory.length}</>}
        empty={
          inventoryItems === null
            ? 'Failed to load inventory items from homelab-api.'
            : sortedInventory.length === 0
              ? 'None.'
              : undefined
        }
      >
        <ScrollableTable className="mb-0">
          <Table size="small" color="secondary">
            <TableHead>
              <TableRow>
                <Th color="secondary">Decision</Th>
                <Th color="secondary">Path</Th>
                <Th color="secondary">Kind</Th>
                <Th color="secondary">Recommendation</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedInventory.map((inventoryItem) => (
                <TableRow key={inventoryItem.id}>
                  <Td color="secondary">
                    <Badge color={DECISION_COLOR[inventoryItem.decision]}>
                      {DECISION_LABELS[inventoryItem.decision]}
                    </Badge>
                  </Td>
                  <Td color="secondary" className="break-all">
                    <Link
                      href={inventoryItemUrl(sourceId, inventoryItem.rootPath)}
                      className="underline"
                    >
                      {relativeToDirectory(item.path, inventoryItem.rootPath)}
                    </Link>
                  </Td>
                  <Td color="secondary">{inventoryItem.kind}</Td>
                  <Td color="secondary">
                    <Badge
                      color={RECOMMENDATION_COLOR[inventoryItem.recommendation]}
                    >
                      {RECOMMENDATION_LABELS[inventoryItem.recommendation]}
                    </Badge>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      </Section>

      <Section
        title={<>Unreadable directories · {result?.unreadable?.length ?? 0}</>}
        empty={
          !result
            ? 'Not explored yet.'
            : !result.unreadable?.length
              ? 'None.'
              : undefined
        }
      >
        <Typography variant="body2" className="text-neutral-400">
          Failed; retry once access is granted.
        </Typography>
        <ScrollableTable className="mb-0">
          <Table size="small" color="secondary">
            <TableHead>
              <TableRow>
                <Th color="secondary">Path</Th>
                <Th color="secondary">Error</Th>
              </TableRow>
            </TableHead>
            <TableBody>
              {(result?.unreadable ?? []).map((entry) => (
                <TableRow key={entry.path}>
                  <Td color="secondary" className="break-all">
                    {relativeToDirectory(item.path, entry.path)}
                  </Td>
                  <Td color="secondary" className="text-neutral-400">
                    {entry.error}
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      </Section>

      {inventoryingDirectory && (
        <InventoryDirectoryModal
          open
          onOpenChange={setInventoryingDirectory}
          queueItem={item}
          onInventoried={(path, skipped) => {
            setNotice(
              `Added ${path} to the inventory; ${skipped} queued ${skipped === 1 ? 'directory' : 'directories'} inside it skipped.`,
            );
            router.refresh();
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
          onPromoted={() => router.refresh()}
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
          inventoried={new Set(inventoriedPaths)}
          onPromoted={() => router.refresh()}
        />
      )}
    </main>
  );
}
