import { notFound } from 'next/navigation';
import { getHost, type Host } from '../../../infra/hosts/lib/homelab-api';
import {
  getSources,
  getDiscoveryJob,
  getDiscoveryJobs,
  getQueueItems,
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

  // The newest job is the one worth showing, running or already finished.
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
