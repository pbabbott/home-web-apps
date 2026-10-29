import { notFound } from 'next/navigation';
import { parseBackupItemStatus } from '../../lib/backup-display';
import {
  getBackupDestinations,
  getBackupJob,
  getBackupJobItems,
  getSources,
  type BackupJob,
  type BackupJobItem,
} from '../../sources/lib/homelab-api';
import { BackupLoadError } from '../BackupLoadError';
import { BackupJobClient } from './BackupJobClient';

type PageProps = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function ExodusBackupJobPage({
  params,
  searchParams,
}: PageProps) {
  const { jobId } = await params;
  const status = parseBackupItemStatus((await searchParams).status);

  let job: BackupJob;

  try {
    job = await getBackupJob(jobId);
  } catch (err) {
    // Not found (or a malformed id): homelab-api answers 404 or 400.
    if (err instanceof Error && /returned (404|400)\b/.test(err.message)) {
      notFound();
    }

    console.error('Failed to load the backup job from homelab-api:', err);
    return <BackupLoadError what="the backup job" />;
  }

  const [itemsResult, sourcesResult, destinationsResult] =
    await Promise.allSettled([
      getBackupJobItems(jobId, status),
      getSources(),
      getBackupDestinations(),
    ]);

  let items: BackupJobItem[] | null = null;
  let hasMoreItems = false;

  if (itemsResult.status === 'fulfilled') {
    items = itemsResult.value.items;
    hasMoreItems = itemsResult.value.next !== null;
  } else {
    console.error('Failed to load backup job items:', itemsResult.reason);
  }

  const sourceName =
    sourcesResult.status === 'fulfilled'
      ? sourcesResult.value.find((s) => s.id === job.sourceId)?.name
      : undefined;
  const destinationName =
    destinationsResult.status === 'fulfilled'
      ? destinationsResult.value.find((d) => d.id === job.destinationId)?.name
      : undefined;

  return (
    <BackupJobClient
      job={job}
      sourceName={sourceName ?? null}
      destinationName={destinationName ?? null}
      items={items}
      hasMoreItems={hasMoreItems}
      statusFilter={status}
    />
  );
}
