import { HostsClient } from './HostsClient';
import { getHosts, type Host, type HostType } from './lib/homelab-api';

const DEFAULT_HOST_TYPE: HostType = 'physical';
const VALID_HOST_TYPES: HostType[] = ['physical', 'virtual'];

interface HostsPageProps {
  searchParams: Promise<{ type?: string; host?: string }>;
}

export default async function HostsPage({ searchParams }: HostsPageProps) {
  const { type: typeParam, host: selectedHostId } = await searchParams;

  const hostType: HostType = VALID_HOST_TYPES.includes(typeParam as HostType)
    ? (typeParam as HostType)
    : DEFAULT_HOST_TYPE;

  let hosts: Host[] | null = null;

  try {
    hosts = await getHosts(hostType);
  } catch (err) {
    console.error('Failed to load hosts from homelab-api:', err);
  }

  return (
    <HostsClient
      hosts={hosts}
      hostType={hostType}
      selectedHostId={selectedHostId ?? null}
    />
  );
}
