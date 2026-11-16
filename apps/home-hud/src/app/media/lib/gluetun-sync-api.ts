const GLUETUN_SYNC_URL =
  process.env.GLUETUN_SYNC_URL ?? 'http://localhost:4000';

export interface PortsResult {
  gluetunPort: string | null;
  qbitTorrentPort: string | null;
}

/** gluetun-sync's in-memory record; every field is absent until it first happens (e.g. after a pod restart). Dates are ISO strings. */
export interface SyncStatus {
  lastCronStart?: string;
  lastCronEnd?: string;
  lastSuccess?: string;
  lastFailure?: string;
  lastFailureMessage?: string;
  lastAttempt?: string;
  lastAttemptBy?: 'CRON' | 'API' | 'MCP';
  mostRecentAttemptSuccessful?: boolean;
  cronExpression?: string;
  cronDescription?: string;
}

export interface PublicIp {
  ip: string;
  region: string | null;
  country: string | null;
  city: string | null;
}

export interface ServicesResult {
  gluetun: boolean;
  qbittorrent: boolean;
}

async function getResult<T>(path: string): Promise<T> {
  const res = await fetch(`${GLUETUN_SYNC_URL}${path}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`gluetun-sync GET ${path} returned ${res.status}: ${body}`);
  }

  return ((await res.json()) as { result: T }).result;
}

export const getPorts = () => getResult<PortsResult>('/status/ports');
export const getStatus = () => getResult<SyncStatus>('/status');
export const getPublicIp = () => getResult<PublicIp>('/status/public-ip');
export const getServices = () => getResult<ServicesResult>('/status/services');

/** gluetun-sync's own liveness: true only for a 200 from `/healthz`. */
export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GLUETUN_SYNC_URL}/healthz`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
