import { Request, Response } from 'express';
import {
  NotConfiguredError,
  getArr,
  getDownloadsSummary,
  getQbittorrent,
} from '../../services/media-downloads';
import type { ArrKind } from '../../api/media/arr';
import type { Operation } from '../operation';

export const getQbittorrentStatsOperation = {
  summary: 'Active downloads and transfer speeds from qBittorrent',
  description:
    'Overall download/upload speed plus the busiest active torrents (progress, size, speed, ETA). 503 when qBittorrent credentials are not configured; 502 when qBittorrent cannot be reached or rejects the login.',
  hud: '/media',
} satisfies Operation;

export const getSonarrStatsOperation = {
  summary: 'Sonarr queue size and the most recently imported episode',
  description:
    'Queue length and the latest "downloadFolderImported" history record. 503 when the Sonarr API key is not configured; 502 when Sonarr cannot be reached.',
  hud: '/media',
} satisfies Operation;

export const getRadarrStatsOperation = {
  summary: 'Radarr queue size and the most recently imported movie',
  description:
    'Queue length and the latest "downloadFolderImported" history record. 503 when the Radarr API key is not configured; 502 when Radarr cannot be reached.',
  hud: '/media',
} satisfies Operation;

export const getDownloadsSummaryOperation = {
  summary: 'One-glance downloads summary',
  description:
    'Download/upload speed and active torrent count (qBittorrent), Sonarr and Radarr queue lengths, and free space on the media share. Each field is null when its source is unavailable; the request itself does not fail.',
  hud: '/media',
} satisfies Operation;

/** Maps a failed service read to 503 (not configured) or 502 (upstream trouble). */
function sendServiceError(res: Response, route: string, err: unknown) {
  if (err instanceof NotConfiguredError) {
    res.status(503).json({ message: err.message });
    return;
  }
  console.error(`${route} failed:`, err);
  res.status(502).json({ message: 'could not read from the upstream service' });
}

export const getQbittorrentStatsHandler = async (_: Request, res: Response) => {
  try {
    res.status(200).json(await getQbittorrent());
  } catch (err) {
    sendServiceError(res, 'GET /media/qbittorrent', err);
  }
};

const arrHandler = (kind: ArrKind) => async (_: Request, res: Response) => {
  try {
    res.status(200).json(await getArr(kind));
  } catch (err) {
    sendServiceError(res, `GET /media/${kind}`, err);
  }
};

export const getSonarrStatsHandler = arrHandler('sonarr');
export const getRadarrStatsHandler = arrHandler('radarr');

export const getDownloadsSummaryHandler = async (_: Request, res: Response) => {
  try {
    res.status(200).json(await getDownloadsSummary());
  } catch (err) {
    console.error('GET /media/downloads/summary failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
