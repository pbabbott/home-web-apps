import type { ArrConfig } from './media-config';

const REQUEST_TIMEOUT_MS = 5000;

export type ArrKind = 'sonarr' | 'radarr';

export interface ArrLastImported {
  /** Series or movie title. */
  title: string;
  /** Episode label (`S02E05 · Episode title`) for Sonarr; the release year for Radarr. */
  subtitle: string | null;
  quality: string | null;
  /** ISO timestamp of the import. */
  importedAt: string;
}

export interface ArrStats {
  queueCount: number;
  lastImported: ArrLastImported | null;
}

async function arrGet<T>(config: ArrConfig, path: string): Promise<T> {
  const res = await fetch(`${config.url}${path}`, {
    headers: { 'X-Api-Key': config.apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

// Sonarr and Radarr share the v3 history/queue shape. eventType 3 is
// "downloadFolderImported": the item landed in the library, i.e. was obtained.
const IMPORTED = 'eventType=3';
const NEWEST_FIRST = 'page=1&pageSize=1&sortKey=date&sortDirection=descending';

interface HistoryRecord {
  date: string;
  quality?: { quality?: { name?: string } };
  series?: { title?: string };
  episode?: { title?: string; seasonNumber?: number; episodeNumber?: number };
  movie?: { title?: string; year?: number };
  sourceTitle?: string;
}

const pad = (n: number | undefined) => String(n ?? 0).padStart(2, '0');

function toLastImported(
  kind: ArrKind,
  record: HistoryRecord | undefined,
): ArrLastImported | null {
  if (!record) return null;

  const quality = record.quality?.quality?.name ?? null;
  if (kind === 'sonarr') {
    const { episode } = record;
    const label = episode
      ? `S${pad(episode.seasonNumber)}E${pad(episode.episodeNumber)}`
      : null;
    return {
      title: record.series?.title ?? record.sourceTitle ?? 'Unknown series',
      subtitle: label && episode?.title ? `${label} · ${episode.title}` : label,
      quality,
      importedAt: record.date,
    };
  }

  return {
    title: record.movie?.title ?? record.sourceTitle ?? 'Unknown movie',
    subtitle: record.movie?.year ? String(record.movie.year) : null,
    quality,
    importedAt: record.date,
  };
}

export async function getArrStats(
  kind: ArrKind,
  config: ArrConfig,
): Promise<ArrStats> {
  const include =
    kind === 'sonarr'
      ? 'includeSeries=true&includeEpisode=true'
      : 'includeMovie=true';

  const [queue, history] = await Promise.all([
    arrGet<{ totalRecords: number }>(config, '/api/v3/queue?page=1&pageSize=1'),
    arrGet<{ records: HistoryRecord[] }>(
      config,
      `/api/v3/history?${NEWEST_FIRST}&${IMPORTED}&${include}`,
    ),
  ]);

  return {
    queueCount: queue.totalRecords,
    lastImported: toLastImported(kind, history.records[0]),
  };
}
