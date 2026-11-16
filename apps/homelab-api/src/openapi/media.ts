import { z } from 'zod';
import { getMediaDiskSpaceOperation } from '../controllers/media/disk-space';
import { getGluetunSyncLogsOperation } from '../controllers/media/gluetun-sync-logs';
import {
  getDownloadsSummaryOperation,
  getQbittorrentStatsOperation,
  getRadarrStatsOperation,
  getSonarrStatsOperation,
} from '../controllers/media/downloads';
import { logsQuerySchema } from '../schemas/media';
import { validationErrorResponse } from './common';

export const mediaDiskSpaceSchema = z.object({
  host: z.string().meta({ example: 'room_of_requirement' }),
  mountpoint: z.string().meta({ example: '/share/Media' }),
  totalBytes: z.number(),
  usedBytes: z.number(),
  availableBytes: z.number(),
  usedRatio: z.number().meta({ description: 'usedBytes / totalBytes, 0-1' }),
});

const messageSchema = z.object({ message: z.string() });

const downloadsSummarySchema = z.object({
  downloadSpeed: z
    .number()
    .nullable()
    .meta({ description: 'Bytes per second' }),
  uploadSpeed: z.number().nullable().meta({ description: 'Bytes per second' }),
  activeTorrents: z.number().nullable(),
  sonarrQueue: z.number().nullable(),
  radarrQueue: z.number().nullable(),
  diskAvailableBytes: z.number().nullable(),
});

const qbittorrentStatsSchema = z.object({
  downloadSpeed: z.number().meta({ description: 'Bytes per second' }),
  uploadSpeed: z.number().meta({ description: 'Bytes per second' }),
  activeCount: z.number(),
  torrents: z.array(
    z.object({
      name: z.string(),
      progress: z.number().meta({ description: '0-1' }),
      sizeBytes: z.number(),
      downloadSpeed: z.number(),
      uploadSpeed: z.number(),
      etaSeconds: z.number().nullable(),
      state: z.string(),
    }),
  ),
});

const arrStatsSchema = z.object({
  queueCount: z.number(),
  lastImported: z
    .object({
      title: z.string(),
      subtitle: z.string().nullable(),
      quality: z.string().nullable(),
      importedAt: z.string(),
    })
    .nullable(),
});

const upstreamResponses = {
  '502': {
    description: 'The upstream service could not be reached',
    content: { 'application/json': { schema: messageSchema } },
  },
  '503': {
    description: 'The service credentials are not configured',
    content: { 'application/json': { schema: messageSchema } },
  },
};

export const mediaPaths = {
  '/media/disk-space': {
    get: {
      summary: getMediaDiskSpaceOperation.summary,
      description: getMediaDiskSpaceOperation.description,
      responses: {
        '200': {
          description: 'Media share usage',
          content: { 'application/json': { schema: mediaDiskSpaceSchema } },
        },
        '404': {
          description: 'Prometheus has no data for the mount',
          content: { 'application/json': { schema: messageSchema } },
        },
      },
    },
  },
  '/media/gluetun-sync/logs': {
    get: {
      summary: getGluetunSyncLogsOperation.summary,
      description: getGluetunSyncLogsOperation.description,
      requestParams: { query: logsQuerySchema },
      responses: {
        '200': {
          description: 'Log lines, oldest first',
          content: {
            'application/json': {
              schema: z.object({ lines: z.array(z.string()) }),
            },
          },
        },
        '400': validationErrorResponse,
        '404': {
          description: 'The gluetun-sync pod is not running',
          content: { 'application/json': { schema: messageSchema } },
        },
      },
    },
  },
  '/media/downloads/summary': {
    get: {
      summary: getDownloadsSummaryOperation.summary,
      description: getDownloadsSummaryOperation.description,
      responses: {
        '200': {
          description: 'Summary numbers (null where unavailable)',
          content: { 'application/json': { schema: downloadsSummarySchema } },
        },
      },
    },
  },
  '/media/qbittorrent': {
    get: {
      summary: getQbittorrentStatsOperation.summary,
      description: getQbittorrentStatsOperation.description,
      responses: {
        '200': {
          description: 'qBittorrent transfer stats',
          content: { 'application/json': { schema: qbittorrentStatsSchema } },
        },
        ...upstreamResponses,
      },
    },
  },
  '/media/sonarr': {
    get: {
      summary: getSonarrStatsOperation.summary,
      description: getSonarrStatsOperation.description,
      responses: {
        '200': {
          description: 'Sonarr stats',
          content: { 'application/json': { schema: arrStatsSchema } },
        },
        ...upstreamResponses,
      },
    },
  },
  '/media/radarr': {
    get: {
      summary: getRadarrStatsOperation.summary,
      description: getRadarrStatsOperation.description,
      responses: {
        '200': {
          description: 'Radarr stats',
          content: { 'application/json': { schema: arrStatsSchema } },
        },
        ...upstreamResponses,
      },
    },
  },
};
