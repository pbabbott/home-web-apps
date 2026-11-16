import { getArrStats, type ArrKind, type ArrStats } from '../api/media/arr';
import {
  getQbittorrentConfig,
  getRadarrConfig,
  getSonarrConfig,
} from '../api/media/media-config';
import {
  getQbittorrentStats,
  type QbittorrentStats,
} from '../api/media/qbittorrent';
import { getMediaDiskSpace } from './media-disk-space';

/** Thrown when a service's URL/credentials aren't in the environment; surfaces as 503. */
export class NotConfiguredError extends Error {}

export interface DownloadsSummary {
  /** Each field is null when its source could not be read. */
  downloadSpeed: number | null;
  uploadSpeed: number | null;
  activeTorrents: number | null;
  sonarrQueue: number | null;
  radarrQueue: number | null;
  diskAvailableBytes: number | null;
}

export async function getQbittorrent(): Promise<QbittorrentStats> {
  const config = getQbittorrentConfig();
  if (!config) throw new NotConfiguredError('qBittorrent is not configured');
  return getQbittorrentStats(config);
}

export async function getArr(kind: ArrKind): Promise<ArrStats> {
  const config = kind === 'sonarr' ? getSonarrConfig() : getRadarrConfig();
  if (!config) throw new NotConfiguredError(`${kind} is not configured`);
  return getArrStats(kind, config);
}

const valueOrNull = <T>(result: PromiseSettledResult<T>): T | null =>
  result.status === 'fulfilled' ? result.value : null;

/** One-glance numbers composed from the per-service reads; a failing source blanks only its own fields. */
export async function getDownloadsSummary(): Promise<DownloadsSummary> {
  const [qbit, sonarr, radarr, disk] = await Promise.allSettled([
    getQbittorrent(),
    getArr('sonarr'),
    getArr('radarr'),
    getMediaDiskSpace(),
  ]);

  const q = valueOrNull(qbit);
  return {
    downloadSpeed: q?.downloadSpeed ?? null,
    uploadSpeed: q?.uploadSpeed ?? null,
    activeTorrents: q?.activeCount ?? null,
    sonarrQueue: valueOrNull(sonarr)?.queueCount ?? null,
    radarrQueue: valueOrNull(radarr)?.queueCount ?? null,
    diskAvailableBytes: valueOrNull(disk)?.availableBytes ?? null,
  };
}
