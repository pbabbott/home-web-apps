import { Router } from 'express';
import { getMediaDiskSpaceHandler } from '../../controllers/media/disk-space';

export const mediaRouter = Router();

mediaRouter.get('/media/disk-space', getMediaDiskSpaceHandler);
