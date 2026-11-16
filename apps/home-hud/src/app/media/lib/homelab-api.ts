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

export interface DownloadsSummary {
  /** Bytes per second. Every field is null when its source could not be read. */
  downloadSpeed: number | null;
  uploadSpeed: number | null;
  activeTorrents: number | null;
  sonarrQueue: number | null;
  radarrQueue: number | null;
  diskAvailableBytes: number | null;
}

export interface QbittorrentTorrent {
  name: string;
  /** 0-1. */
  progress: number;
  sizeBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
  etaSeconds: number | null;
  state: string;
}

export interface QbittorrentStats {
  downloadSpeed: number;
  uploadSpeed: number;
  activeCount: number;
  torrents: QbittorrentTorrent[];
}

export interface ArrStats {
  queueCount: number;
  lastImported: {
    title: string;
    subtitle: string | null;
    quality: string | null;
    /** ISO timestamp. */
    importedAt: string;
  } | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${HOMELAB_API_URL}${path}`, { cache: 'no-store' });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api GET ${path} returned ${res.status}: ${body}`);
  }

  return (await res.json()) as T;
}

export const getDownloadsSummary = () =>
  getJson<DownloadsSummary>('/media/downloads/summary');
export const getQbittorrentStats = () =>
  getJson<QbittorrentStats>('/media/qbittorrent');
export const getSonarrStats = () => getJson<ArrStats>('/media/sonarr');
export const getRadarrStats = () => getJson<ArrStats>('/media/radarr');
