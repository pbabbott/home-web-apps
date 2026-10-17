import { getHosts, type Host } from '../../infra/hosts/lib/homelab-api';
import { SourcesClient } from './SourcesClient';
import { getBackupSources, type BackupSource } from './lib/homelab-api';

export default async function SourcesPage() {
  let sources: BackupSource[] | null = null;
  let hosts: Host[] | null = null;

  const [sourcesResult, hostsResult] = await Promise.allSettled([
    getBackupSources(),
    getHosts(),
  ]);

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

  return <SourcesClient sources={sources} hosts={hosts} />;
}
