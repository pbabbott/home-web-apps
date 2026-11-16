// Read lazily from the environment rather than through `config.ts`: a field
// with an empty default there is *required* and stops the process at startup,
// but these services are optional — without them the /media routes answer
// 503 and everything else keeps working (also true while a deploy rolls out
// ahead of its secrets).

export interface ArrConfig {
  url: string;
  apiKey: string;
}

export interface QbittorrentConfig {
  url: string;
  username: string;
  password: string;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

function arrConfig(prefix: 'SONARR' | 'RADARR', defaultUrl: string) {
  return (): ArrConfig | null => {
    const apiKey = process.env[`${prefix}_API_KEY`];
    if (!apiKey) return null;
    return {
      url: trimSlash(process.env[`${prefix}_URL`] || defaultUrl),
      apiKey,
    };
  };
}

export const getSonarrConfig = arrConfig(
  'SONARR',
  'http://sonarr.media.svc.cluster.local:8989',
);
export const getRadarrConfig = arrConfig(
  'RADARR',
  'http://radarr.media.svc.cluster.local:7878',
);

export function getQbittorrentConfig(): QbittorrentConfig | null {
  const username = process.env.QBITTORRENT_USERNAME;
  const password = process.env.QBITTORRENT_PASSWORD;
  if (!username || !password) return null;
  return {
    url: trimSlash(
      process.env.QBITTORRENT_URL ||
        'http://qbittorrent-ui.media.svc.cluster.local:8080',
    ),
    username,
    password,
  };
}
