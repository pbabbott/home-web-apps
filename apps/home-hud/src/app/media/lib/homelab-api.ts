const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export interface MediaDiskSpace {
  host: string;
  mountpoint: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  /** usedBytes / totalBytes, 0-1. */
  usedRatio: number;
}

export async function getMediaDiskSpace(): Promise<MediaDiskSpace> {
  const res = await fetch(`${HOMELAB_API_URL}/media/disk-space`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /media/disk-space returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as MediaDiskSpace;
}

/** The last `tail` gluetun-sync log lines (oldest first), read through homelab-api's Kubernetes client. */
export async function getGluetunSyncLogs(tail = 200): Promise<string[]> {
  const res = await fetch(
    `${HOMELAB_API_URL}/media/gluetun-sync/logs?tail=${tail}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /media/gluetun-sync/logs returned ${res.status}: ${body}`,
    );
  }

  return ((await res.json()) as { lines: string[] }).lines;
}
