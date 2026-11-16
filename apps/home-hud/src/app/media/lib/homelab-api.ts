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
