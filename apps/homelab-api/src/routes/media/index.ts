import { Router } from 'express';
import { validateQuery } from '@abbottland/express';
import { getMediaDiskSpaceHandler } from '../../controllers/media/disk-space';
import {
  getDownloadsSummaryHandler,
  getQbittorrentStatsHandler,
  getRadarrStatsHandler,
  getSonarrStatsHandler,
} from '../../controllers/media/downloads';
import { getGluetunSyncLogs } from '../../controllers/media/gluetun-sync-logs';
import { logsQuerySchema } from '../../schemas/media';

export const mediaRouter = Router();

mediaRouter.get('/media/disk-space', getMediaDiskSpaceHandler);
mediaRouter.get(
  '/media/gluetun-sync/logs',
  validateQuery(logsQuerySchema),
  getGluetunSyncLogs,
);
mediaRouter.get('/media/downloads/summary', getDownloadsSummaryHandler);
mediaRouter.get('/media/qbittorrent', getQbittorrentStatsHandler);
mediaRouter.get('/media/sonarr', getSonarrStatsHandler);
mediaRouter.get('/media/radarr', getRadarrStatsHandler);
