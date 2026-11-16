const GLUETUN_SYNC_URL =
  process.env.GLUETUN_SYNC_URL ?? 'http://localhost:4000';

export interface PortsResult {
  gluetunPort: string | null;
  qbitTorrentPort: string | null;
}

export async function getPorts(): Promise<PortsResult> {
  const res = await fetch(`${GLUETUN_SYNC_URL}/status/ports`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `gluetun-sync GET /status/ports returned ${res.status}: ${body}`,
    );
  }

  const data = (await res.json()) as { result: PortsResult };
  return data.result;
}
