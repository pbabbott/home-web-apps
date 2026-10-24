import { notFound } from 'next/navigation';
import {
  getHost,
  getHosts,
  type Host,
} from '../../../infra/hosts/lib/homelab-api';
import {
  getSources,
  getDiscoveryJob,
  getDiscoveryJobs,
  getJobQueueItems,
  isActiveJob,
  type Source,
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

  let sources: Source[];

  try {
    sources = await getSources();
  } catch (err) {
    console.error('Failed to load sources from homelab-api:', err);
    return <SourceLoadError />;
  }

  const source = sources.find((s) => s.id === id);

  if (!source) notFound();

  const [hostResult, jobsResult, hostsResult] = await Promise.allSettled([
    source.hostId ? getHost(source.hostId) : Promise.resolve(null),
    getDiscoveryJobs(id),
    getHosts(),
  ]);

  const host: Host | null = unwrap(hostResult, 'host');
  const jobs: DiscoveryJob[] | null = unwrap(jobsResult, 'discovery jobs');
  const hosts: Host[] | null = unwrap(hostsResult, 'hosts');

  // The newest job is the one worth showing, running or already finished.
  let latestJob: DiscoveryJobWithCounts | null = null;

  if (jobs && jobs.length > 0) {
    try {
      latestJob = await getDiscoveryJob(jobs[0].id);
    } catch (err) {
      console.error('Failed to load the latest discovery job:', err);
    }
  }

  // Failures belong to the job shown in the current job panel, not the whole source.
  let failedItems: QueueItem[] | null = [];

  if (latestJob) {
    try {
      failedItems = await getJobQueueItems(latestJob.id, 'failed');
    } catch (err) {
      console.error('Failed to load failed items from homelab-api:', err);
      failedItems = null;
    }
  }

  return (
    <SourceDetailClient
      source={source}
      host={host}
      hosts={hosts}
      jobs={jobs}
      latestJob={latestJob}
      failedItems={failedItems}
      hasActiveJob={jobs?.some(isActiveJob) ?? false}
    />
  );
}
