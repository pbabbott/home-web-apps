import { notFound } from 'next/navigation';
import {
  getDiscoveryJob,
  getJobQueueItems,
  getSources,
  type DiscoveryJobWithCounts,
  type QueueItem,
} from '../../sources/lib/homelab-api';
import { parseQueueStatus } from '../../lib/job-display';
import { JobDetailClient } from './JobDetailClient';

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExodusJobDetailPage({
  params,
  searchParams,
}: JobDetailPageProps) {
  const [{ id }, { status: statusParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  // A hand-edited id that is not a uuid would 400 the API.
  if (!UUID_PATTERN.test(id)) notFound();

  const status = parseQueueStatus(statusParam);

  let job: DiscoveryJobWithCounts;

  try {
    job = await getDiscoveryJob(id);
  } catch (err) {
    // The API answers 404 for an unknown job; anything else is also shown as
    // not found rather than as a half-rendered page.
    console.error('Failed to load the discovery job from homelab-api:', err);
    notFound();
  }

  const [itemsResult, sourcesResult] = await Promise.allSettled([
    getJobQueueItems(id, status),
    getSources(),
  ]);

  let items: QueueItem[] | null = null;

  if (itemsResult.status === 'fulfilled') {
    items = itemsResult.value;
  } else {
    console.error(
      'Failed to load queue items from homelab-api:',
      itemsResult.reason,
    );
  }

  const sourceName =
    sourcesResult.status === 'fulfilled'
      ? (sourcesResult.value.find((s) => s.id === job.sourceId)?.name ?? null)
      : null;

  return (
    <JobDetailClient
      job={job}
      sourceName={sourceName}
      items={items}
      status={status ?? null}
    />
  );
}
