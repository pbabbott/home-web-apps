'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Badge,
  OutlinedButton,
  Panel,
  Tooltip,
  Typography,
} from '@abbottland/fui-components';
import {
  QUEUE_STATUS_COLOR,
  QUEUE_STATUS_DESCRIPTION,
  isStaleClaim,
  jobDetailUrl,
} from '../../../../lib/job-display';
import { QueueItemMessage } from '../../../../lib/JobSummary';
import {
  CopyButton,
  Detail,
  ReviewedMark,
} from '../../../../lib/DirectoryReview';
import { inventoryItemUrl } from '../../../../lib/inventory-display';
import { LocalDateTime } from '../../../../lib/LocalDateTime';
import { PatternMatchesModal } from '../../../../lib/PatternMatchesModal';
import { PromoteSkippedModal } from '../../../../lib/PromoteSkippedModal';
import { InventoryDirectoryModal } from './InventoryDirectoryModal';
import { InventoryItemsSection } from './InventoryItemsSection';
import { OnDiskSection } from './OnDiskSection';
import { SkippedGroupsSection } from './SkippedGroupsSection';
import { SkippedPathsSection } from './SkippedPathsSection';
import { UnreadableSection } from './UnreadableSection';
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
import { useAutoRefresh } from '../../../../lib/useAutoRefresh';

/** While the directory may still change under the agent's hands the page re-fetches this often. */
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

  useAutoRefresh(active && settling);

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

      <SkippedGroupsSection
        item={item}
        pending={pending !== null}
        onSetReviewed={(path, pattern, reviewed) =>
          void setReviewed(path, pattern, reviewed)
        }
        onViewPattern={setViewingPattern}
      />

      <SkippedPathsSection
        item={item}
        pending={pending !== null}
        onSetReviewed={(path, pattern, reviewed) =>
          void setReviewed(path, pattern, reviewed)
        }
        onPromote={(skip) => setPromoting(skip)}
      />

      <OnDiskSection
        sourceId={sourceId}
        queueItemId={item.id}
        review={item.onDiskReview}
        onReviewChanged={() => router.refresh()}
        coverageSignature={JSON.stringify([
          skipReview,
          item.inventoryByDecision,
          directoryApproved,
        ])}
        onPromote={(path) => setPromoting({ path })}
      />

      <InventoryItemsSection item={item} inventoryItems={inventoryItems} />

      <UnreadableSection item={item} />

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
