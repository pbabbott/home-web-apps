import { Router } from 'express';
import { validateQuery } from '@abbottland/express';
import { getMediaDiskSpaceHandler } from '../../controllers/media/disk-space';
import { getGluetunSyncLogs } from '../../controllers/media/gluetun-sync-logs';
import { logsQuerySchema } from '../../schemas/media';

export const mediaRouter = Router();

mediaRouter.get('/media/disk-space', getMediaDiskSpaceHandler);
mediaRouter.get(
  '/media/gluetun-sync/logs',
  validateQuery(logsQuerySchema),
  getGluetunSyncLogs,
);
