'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OutlinedButton, Typography } from '@abbottland/fui-components';
import type { Host } from '../../../infra/hosts/lib/homelab-api';
import { inventoryItemsUrl } from '../../lib/inventory-display';
import {
  isActiveJob,
  type Source,
  type DiscoveryJobWithCounts,
  type QueueItem,
} from '../lib/homelab-api';
import { CurrentJobPanel } from './CurrentJobPanel';
import { FailedItemsPanel } from './FailedItemsPanel';
import { JobHistoryPanel } from './JobHistoryPanel';
import { AddSourceModal } from '../AddSourceModal';
import { StartJobModal } from './StartJobModal';

/** While a job is active the page re-fetches this often, so progress shows without a manual reload. */
const ACTIVE_REFRESH_MS = 5000;

interface SourceDetailClientProps {
  source: Source;
  host: Host | null;
  /** Null if the hosts could not be loaded, so the source cannot be edited. */
  hosts: Host[] | null;
  jobs: DiscoveryJobWithCounts[] | null;
  latestJob: DiscoveryJobWithCounts | null;
  failedItems: QueueItem[] | null;
  hasActiveJob: boolean;
  attentionOnly: boolean;
}

export function SourceDetailClient({
  source,
  host,
  hosts,
  jobs,
  latestJob,
  failedItems,
  hasActiveJob,
  attentionOnly,
}: SourceDetailClientProps) {
  const router = useRouter();
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (!hasActiveJob) return;

    const timer = setInterval(() => router.refresh(), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasActiveJob, router]);

  const refresh = () => router.refresh();

  return (
    <main className="flex flex-col gap-6 bg-neutral-800 p-8">
      <div className="flex flex-col gap-2">
        <OutlinedButton
          component={Link}
          href="/exodus/sources"
          color="secondary"
          size="small"
          className="self-start"
        >
          ← Sources
        </OutlinedButton>
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
        <div className="flex gap-3">
          <OutlinedButton
            component={Link}
            href={inventoryItemsUrl({ source: source.id })}
            color="accent-falcon"
            size="small"
          >
            Inventory items →
          </OutlinedButton>
          <OutlinedButton
            color="secondary"
            size="small"
            disabled={hosts === null}
            onClick={() => setEditModalOpen(true)}
          >
            Edit
          </OutlinedButton>
        </div>
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
          <FailedItemsPanel
            items={failedItems}
            activeJobIds={
              new Set((jobs ?? []).filter(isActiveJob).map((job) => job.id))
            }
            onRetried={refresh}
          />
        )
      )}

      {jobs && jobs.length > 0 && (
        <JobHistoryPanel
          sourceId={source.id}
          jobs={jobs}
          attentionOnly={attentionOnly}
        />
      )}

      <AddSourceModal
        key={source.updatedAt}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        hosts={hosts ?? []}
        source={source}
        onSaved={refresh}
      />

      <StartJobModal
        sourceId={source.id}
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        onStarted={refresh}
      />
    </main>
  );
}
