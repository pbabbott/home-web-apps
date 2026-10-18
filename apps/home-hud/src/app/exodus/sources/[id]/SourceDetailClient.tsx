'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OutlinedButton, Typography } from '@abbottland/fui-components';
import type { Host } from '../../../infra/hosts/lib/homelab-api';
import { inventoryUrl } from '../../lib/inventory-display';
import {
  isActiveJob,
  type Source,
  type DiscoveryJob,
  type DiscoveryJobWithCounts,
  type QueueItem,
} from '../lib/homelab-api';
import { CurrentJobPanel } from './CurrentJobPanel';
import { FailedItemsPanel } from './FailedItemsPanel';
import { JobHistoryPanel } from './JobHistoryPanel';
import { StartJobModal } from './StartJobModal';

/** While a job is active the page re-fetches this often, so progress shows without a manual reload. */
const ACTIVE_REFRESH_MS = 5000;

interface SourceDetailClientProps {
  source: Source;
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
        <OutlinedButton
          component={Link}
          href={inventoryUrl({ source: source.id })}
          color="accent-falcon"
          size="small"
          className="self-start"
        >
          Browse inventory →
        </OutlinedButton>
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
