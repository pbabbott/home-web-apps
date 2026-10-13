import { HostsClient } from './HostsClient';
import {
  getHostCpuMetrics,
  getHostDiskIoMetrics,
  getHostDiskSpace,
  getHostMemoryMetrics,
  getHosts,
  getHostTemperatureMetrics,
  type Host,
  type HostCpuMetrics,
  type HostDiskIoMetrics,
  type HostDiskSpace,
  type HostMemoryMetrics,
  type HostTemperatureMetrics,
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
  let temperatureMetrics: HostTemperatureMetrics | null = null;

  if (selectedHostId) {
    // Temperature only exists for physical hosts (no hwmon data inside a
    // VM) — skip the request entirely for the virtual host list.
    const metricFetches: [
      Promise<HostCpuMetrics | null>,
      Promise<HostMemoryMetrics | null>,
      Promise<HostDiskIoMetrics | null>,
      Promise<HostDiskSpace | null>,
      Promise<HostTemperatureMetrics | null>,
    ] = [
      getHostCpuMetrics(selectedHostId),
      getHostMemoryMetrics(selectedHostId),
      getHostDiskIoMetrics(selectedHostId),
      getHostDiskSpace(selectedHostId),
      hostType === 'physical'
        ? getHostTemperatureMetrics(selectedHostId)
        : Promise.resolve(null),
    ];

    const [
      cpuResult,
      memoryResult,
      diskIoResult,
      diskSpaceResult,
      temperatureResult,
    ] = await Promise.allSettled(metricFetches);

    cpuMetrics = unwrap(cpuResult, 'CPU metrics');
    memoryMetrics = unwrap(memoryResult, 'memory metrics');
    diskIoMetrics = unwrap(diskIoResult, 'disk I/O metrics');
    diskSpace = unwrap(diskSpaceResult, 'disk space');
    temperatureMetrics = unwrap(temperatureResult, 'temperature metrics');
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
      temperatureMetrics={temperatureMetrics}
    />
  );
}
