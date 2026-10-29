import {
  getBackupDestinations,
  getBackupJobs,
  getSources,
  type BackupDestination,
  type BackupJob,
  type Source,
} from '../sources/lib/homelab-api';
import { BackupLoadError } from './BackupLoadError';
import { BackupOverviewClient } from './BackupOverviewClient';

type PageProps = {
  searchParams: Promise<{ source?: string; destination?: string }>;
};

export default async function ExodusBackupPage({ searchParams }: PageProps) {
  const query = await searchParams;

  let sources: Source[];
  let destinations: BackupDestination[];

  try {
    [sources, destinations] = await Promise.all([
      getSources(),
      getBackupDestinations(),
    ]);
  } catch (err) {
    console.error('Failed to load backup data from homelab-api:', err);
    return <BackupLoadError what="sources and destinations" />;
  }

  // Falls back to the first of each, as the inventory page does.
  const source = sources.find((s) => s.id === query.source) ?? sources[0];
  const destination =
    destinations.find((d) => d.id === query.destination) ?? destinations[0];

  let jobs: BackupJob[] | null = null;

  if (source && destination) {
    try {
      jobs = await getBackupJobs({
        sourceId: source.id,
        destinationId: destination.id,
      });
    } catch (err) {
      console.error('Failed to load backup jobs from homelab-api:', err);
    }
  }

  return (
    <BackupOverviewClient
      sources={sources.map(({ id, name }) => ({ id, name }))}
      destinations={destinations}
      sourceId={source?.id ?? null}
      destinationId={destination?.id ?? null}
      jobs={jobs}
    />
  );
}
