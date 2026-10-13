import { HostsClient } from './HostsClient';
import {
  getHostCpuMetrics,
  getHostDiskIoMetrics,
  getHostDiskSpace,
  getHostMemoryMetrics,
  getHosts,
  type Host,
  type HostCpuMetrics,
  type HostDiskIoMetrics,
  type HostDiskSpace,
  type HostMemoryMetrics,
  type HostType,
} from './lib/homelab-api';

const DEFAULT_HOST_TYPE: HostType = 'physical';
const VALID_HOST_TYPES: HostType[] = ['physical', 'virtual'];

interface HostsPageProps {
  searchParams: Promise<{ type?: string; host?: string }>;
}

function unwrap<T>(result: PromiseSettledResult<T>, label: string): T | null {
  if (result.status === 'fulfilled') return result.value;

  console.error(`Failed to load ${label} from homelab-api:`, result.reason);
  return null;
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

  let cpuMetrics: HostCpuMetrics | null = null;
  let memoryMetrics: HostMemoryMetrics | null = null;
  let diskIoMetrics: HostDiskIoMetrics | null = null;
  let diskSpace: HostDiskSpace | null = null;

  if (selectedHostId) {
    const [cpuResult, memoryResult, diskIoResult, diskSpaceResult] =
      await Promise.allSettled([
        getHostCpuMetrics(selectedHostId),
        getHostMemoryMetrics(selectedHostId),
        getHostDiskIoMetrics(selectedHostId),
        getHostDiskSpace(selectedHostId),
      ]);

    cpuMetrics = unwrap(cpuResult, 'CPU metrics');
    memoryMetrics = unwrap(memoryResult, 'memory metrics');
    diskIoMetrics = unwrap(diskIoResult, 'disk I/O metrics');
    diskSpace = unwrap(diskSpaceResult, 'disk space');
  }

  return (
    <HostsClient
      hosts={hosts}
      hostType={hostType}
      selectedHostId={selectedHostId ?? null}
      cpuMetrics={cpuMetrics}
      memoryMetrics={memoryMetrics}
      diskIoMetrics={diskIoMetrics}
      diskSpace={diskSpace}
    />
  );
}
