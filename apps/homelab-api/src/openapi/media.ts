import { z } from 'zod';
import { getMediaDiskSpaceOperation } from '../controllers/media/disk-space';
import { getGluetunSyncLogsOperation } from '../controllers/media/gluetun-sync-logs';
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
};
