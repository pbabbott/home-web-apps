import { notFound } from 'next/navigation';
import { getHost, type Host } from '../../../infra/hosts/lib/homelab-api';
import {
  getBackupSources,
  getDiscoveryJob,
  getDiscoveryJobs,
  getQueueItems,
  isActiveJob,
  type BackupSource,
  type DiscoveryJob,
  type DiscoveryJobWithCounts,
  type QueueItem,
} from '../lib/homelab-api';
import { SourceDetailClient } from './SourceDetailClient';
import { SourceLoadError } from './SourceLoadError';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function unwrap<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === 'fulfilled') return result.value;

  console.error(`Failed to load ${label} from homelab-api:`, result.reason);
  return null;
}

export default async function SourceDetailPage({ params }: PageProps) {
  const { id } = await params;

  let sources: BackupSource[];

  try {
    sources = await getBackupSources();
  } catch (err) {
    console.error('Failed to load backup sources from homelab-api:', err);
    return <SourceLoadError />;
  }

  const source = sources.find((candidate) => candidate.id === id);

  if (!source) notFound();

  const [hostResult, jobsResult, failedResult] = await Promise.allSettled([
    source.hostId ? getHost(source.hostId) : Promise.resolve(null),
    getDiscoveryJobs(id),
    getQueueItems(id, 'failed'),
  ]);

  const host: Host | null = unwrap(hostResult, 'host');
  const jobs: DiscoveryJob[] | null = unwrap(jobsResult, 'discovery jobs');
  const failedItems: QueueItem[] | null = unwrap(failedResult, 'failed items');

  // Queue counts are source-wide, so the newest job's counts describe the
  // source whether that job is still running or already finished.
  let latestJob: DiscoveryJobWithCounts | null = null;

  if (jobs && jobs.length > 0) {
    try {
      latestJob = await getDiscoveryJob(jobs[0].id);
    } catch (err) {
      console.error('Failed to load the latest discovery job:', err);
    }
  }

  return (
    <SourceDetailClient
      source={source}
      host={host}
      jobs={jobs}
      latestJob={latestJob}
      failedItems={failedItems}
      hasActiveJob={jobs?.some(isActiveJob) ?? false}
    />
  );
}
