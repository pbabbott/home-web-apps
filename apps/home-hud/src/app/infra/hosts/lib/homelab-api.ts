const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export type HostType = 'physical' | 'virtual';
export type HostStatus = 'online' | 'offline' | 'unknown';

export interface Host {
  id: string;
  name: string;
  hostType: HostType;
  ipAddress: string;
  instance: string | null;
  createdAt: string;
  status: HostStatus;
  cpuUsageRatio: number | null;
}

export async function getHosts(hostType: HostType): Promise<Host[]> {
  const params = new URLSearchParams({ type: hostType });

  const res = await fetch(`${HOMELAB_API_URL}/hosts?${params}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api GET /hosts returned ${res.status}: ${body}`);
  }

  return (await res.json()) as Host[];
}

export async function getHost(id: string): Promise<Host | null> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /hosts/${id} returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as Host;
}

export interface HostMetricSeriesPoint {
  t: number;
  value: number;
}

export interface HostCpuSeries {
  cpu: string;
  points: HostMetricSeriesPoint[];
}

export interface HostCpuMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostCpuSeries[];
}

/**
 * Per-CPU usage history for the last hour. Best-effort — callers should
 * treat a thrown error the same as "no data" (null) rather than fail the
 * whole page, since this backs a graph, not a critical read.
 */
export async function getHostCpuMetrics(
  id: string,
): Promise<HostCpuMetrics | null> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}/metrics/cpu`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /hosts/${id}/metrics/cpu returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as HostCpuMetrics;
}

export type MemoryComponent = 'used' | 'buffers' | 'cached' | 'free';

export interface HostMemorySeries {
  component: MemoryComponent;
  points: HostMetricSeriesPoint[];
}

export interface HostMemoryMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostMemorySeries[];
}

/**
 * Memory breakdown (used/buffers/cached/free, bytes) for the last hour.
 * Same best-effort contract as `getHostCpuMetrics`.
 */
export async function getHostMemoryMetrics(
  id: string,
): Promise<HostMemoryMetrics | null> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}/metrics/memory`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /hosts/${id}/metrics/memory returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as HostMemoryMetrics;
}

export type DiskIoComponent = 'read' | 'written' | 'ioTime';

export interface HostDiskIoSeries {
  device: string;
  component: DiskIoComponent;
  points: HostMetricSeriesPoint[];
}

export interface HostDiskIoMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostDiskIoSeries[];
}

/**
 * Per-device disk I/O history (read/written bytes/sec, io time ratio) for
 * the last hour. Same best-effort contract as `getHostCpuMetrics`.
 */
export async function getHostDiskIoMetrics(
  id: string,
): Promise<HostDiskIoMetrics | null> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}/metrics/disk-io`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /hosts/${id}/metrics/disk-io returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as HostDiskIoMetrics;
}

export interface HostDiskMountpoint {
  mountpoint: string;
  sizeBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedRatio: number;
}

export interface HostDiskSpace {
  instance: string | null;
  mountpoints: HostDiskMountpoint[];
}

/**
 * Current filesystem usage per mountpoint — an instant snapshot, not a
 * time range (backs a table, not a chart). Same best-effort contract as
 * `getHostCpuMetrics`.
 */
export async function getHostDiskSpace(
  id: string,
): Promise<HostDiskSpace | null> {
  const res = await fetch(`${HOMELAB_API_URL}/hosts/${id}/metrics/disk-space`, {
    cache: 'no-store',
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /hosts/${id}/metrics/disk-space returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as HostDiskSpace;
}
