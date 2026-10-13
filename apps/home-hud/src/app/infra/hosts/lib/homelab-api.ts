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

export interface HostCpuSeriesPoint {
  t: number;
  value: number;
}

export interface HostCpuSeries {
  cpu: string;
  points: HostCpuSeriesPoint[];
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
