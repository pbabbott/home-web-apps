import {
  getAllDiscoveryJobs,
  getSources,
  isActiveJob,
  type Source,
  type DiscoveryJobWithSource,
} from '../sources/lib/homelab-api';
import { JobsClient } from './JobsClient';

interface JobsPageProps {
  searchParams: Promise<{ source?: string; attention?: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

export default async function ExodusJobsPage({ searchParams }: JobsPageProps) {
  const { source: sourceParam, attention } = await searchParams;

  // An id that isn't a uuid would 400 the API; it can only come from a
  // hand-edited URL, so treat it as "no filter" instead of an error page.
  const requestedSourceId = isUuid(sourceParam) ? sourceParam : undefined;

  const [sourcesResult, jobsResult] = await Promise.allSettled([
    getSources(),
    getAllDiscoveryJobs(requestedSourceId),
  ]);

  let sources: Source[] | null = null;
  let jobs: DiscoveryJobWithSource[] | null = null;

  if (sourcesResult.status === 'fulfilled') {
    sources = sourcesResult.value;
  } else {
    console.error(
      'Failed to load sources from homelab-api:',
      sourcesResult.reason,
    );
  }

  if (jobsResult.status === 'fulfilled') {
    jobs = jobsResult.value;
  } else {
    console.error(
      'Failed to load discovery jobs from homelab-api:',
      jobsResult.reason,
    );
  }

  // Only echo a source that exists, so the dropdown never shows a stale id.
  const selectedSourceId =
    requestedSourceId &&
    sources?.some((source) => source.id === requestedSourceId)
      ? requestedSourceId
      : null;

  return (
    <JobsClient
      jobs={jobs}
      sources={sources}
      selectedSourceId={selectedSourceId}
      attentionOnly={attention === '1'}
      hasActiveJob={jobs?.some(isActiveJob) ?? false}
    />
  );
}
