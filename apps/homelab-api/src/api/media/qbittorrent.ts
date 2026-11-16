import type { QbittorrentConfig } from './media-config';

const REQUEST_TIMEOUT_MS = 5000;
const MAX_TORRENTS = 10;

export interface QbittorrentTorrent {
  name: string;
  /** 0-1. */
  progress: number;
  sizeBytes: number;
  downloadSpeed: number;
  uploadSpeed: number;
  /** Seconds, or null when qBittorrent reports "infinity". */
  etaSeconds: number | null;
  state: string;
}

export interface QbittorrentStats {
  /** Bytes per second, across all torrents. */
  downloadSpeed: number;
  uploadSpeed: number;
  activeCount: number;
  /** The busiest active torrents, fastest first. */
  torrents: QbittorrentTorrent[];
}

// qBittorrent's "infinity" ETA.
const ETA_INFINITY = 8640000;

async function login(config: QbittorrentConfig): Promise<string> {
  const res = await fetch(`${config.url}/api/v2/auth/login`, {
    method: 'POST',
    // The WebUI's CSRF protection wants a Referer on its own origin.
    headers: { Referer: config.url },
    body: new URLSearchParams({
      username: config.username,
      password: config.password,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // A bad login is a 200 with body "Fails.", not an error status.
  const body = await res.text();
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!res.ok || !cookie || body.trim() === 'Fails.') {
    throw new Error(`qBittorrent login failed (${res.status})`);
  }
  return cookie;
}

async function get<T>(
  config: QbittorrentConfig,
  cookie: string,
  path: string,
): Promise<T> {
  const res = await fetch(`${config.url}${path}`, {
    headers: { Cookie: cookie, Referer: config.url },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

interface RawTorrent {
  name: string;
  progress: number;
  size: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  state: string;
}

export async function getQbittorrentStats(
  config: QbittorrentConfig,
): Promise<QbittorrentStats> {
  const cookie = await login(config);

  const [transfer, active] = await Promise.all([
    get<{ dl_info_speed: number; up_info_speed: number }>(
      config,
      cookie,
      '/api/v2/transfer/info',
    ),
    get<RawTorrent[]>(config, cookie, '/api/v2/torrents/info?filter=active'),
  ]);

  const torrents = [...active]
    .sort((a, b) => b.dlspeed - a.dlspeed)
    .slice(0, MAX_TORRENTS)
    .map(
      (t): QbittorrentTorrent => ({
        name: t.name,
        progress: t.progress,
        sizeBytes: t.size,
        downloadSpeed: t.dlspeed,
        uploadSpeed: t.upspeed,
        etaSeconds: t.eta >= ETA_INFINITY ? null : t.eta,
        state: t.state,
      }),
    );

  return {
    downloadSpeed: transfer.dl_info_speed,
    uploadSpeed: transfer.up_info_speed,
    activeCount: active.length,
    torrents,
  };
}
