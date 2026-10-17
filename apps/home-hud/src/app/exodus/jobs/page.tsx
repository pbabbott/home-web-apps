import { getHosts, type Host } from '../../infra/hosts/lib/homelab-api';
import {
  getAllDiscoveryJobs,
  getBackupSources,
  isActiveJob,
  type BackupSource,
  type DiscoveryJobWithSource,
} from '../sources/lib/homelab-api';
import { JobsClient } from './JobsClient';

interface JobsPageProps {
  searchParams: Promise<{ source?: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

export default async function ExodusJobsPage({ searchParams }: JobsPageProps) {
  const { source: sourceParam } = await searchParams;

  // An id that isn't a uuid would 400 the API; it can only come from a
  // hand-edited URL, so treat it as "no filter" instead of an error page.
  const requestedSourceId = isUuid(sourceParam) ? sourceParam : undefined;

  const [sourcesResult, hostsResult, jobsResult] = await Promise.allSettled([
    getBackupSources(),
    getHosts(),
    getAllDiscoveryJobs(requestedSourceId),
  ]);

  let sources: BackupSource[] | null = null;
  let hosts: Host[] | null = null;
  let jobs: DiscoveryJobWithSource[] | null = null;

  if (sourcesResult.status === 'fulfilled') {
    sources = sourcesResult.value;
  } else {
    console.error(
      'Failed to load backup sources from homelab-api:',
      sourcesResult.reason,
    );
  }

  if (hostsResult.status === 'fulfilled') {
    hosts = hostsResult.value;
  } else {
    console.error('Failed to load hosts from homelab-api:', hostsResult.reason);
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
      hosts={hosts}
      selectedSourceId={selectedSourceId}
      hasActiveJob={jobs?.some(isActiveJob) ?? false}
    />
  );
}
