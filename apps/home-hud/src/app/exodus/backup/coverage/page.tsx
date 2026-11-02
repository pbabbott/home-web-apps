import { parseCoverageBucket } from '../../lib/backup-display';
import {
  getBackupCoverage,
  getBackupDestinations,
  getSources,
  type BackupCoverage,
  type BackupDestination,
  type Source,
} from '../../sources/lib/homelab-api';
import { BackupLoadError } from '../BackupLoadError';
import { BackupCoverageClient } from './BackupCoverageClient';

type PageProps = {
  searchParams: Promise<{
    source?: string;
    destination?: string;
    bucket?: string;
  }>;
};

export default async function ExodusBackupCoveragePage({
  searchParams,
}: PageProps) {
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

  const source = sources.find((s) => s.id === query.source) ?? sources[0];
  const destination =
    destinations.find((d) => d.id === query.destination) ?? destinations[0];
  const bucket = parseCoverageBucket(query.bucket);

  let coverage: BackupCoverage | null = null;

  if (source && destination) {
    try {
      coverage = await getBackupCoverage(source.id, destination.id, bucket);
    } catch (err) {
      console.error('Failed to load backup coverage from homelab-api:', err);
    }
  }

  return (
    <BackupCoverageClient
      sources={sources.map(({ id, name }) => ({ id, name }))}
      destinations={destinations.map(({ id, name }) => ({ id, name }))}
      sourceId={source?.id ?? null}
      destinationId={destination?.id ?? null}
      bucket={bucket}
      coverage={coverage}
    />
  );
}
