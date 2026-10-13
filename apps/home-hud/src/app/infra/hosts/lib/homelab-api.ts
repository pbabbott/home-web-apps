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
