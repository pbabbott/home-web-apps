import { Request, Response } from 'express';
import { getMediaDiskSpace } from '../../services/media-disk-space';
import type { Operation } from '../operation';

export const getMediaDiskSpaceOperation = {
  summary: 'Current usage of the NAS media share (/share/Media)',
  description:
    'Total/used/available bytes of the media share on room_of_requirement, from node-exporter via Prometheus. 404 when Prometheus has no data for the mount.',
  hud: '/media',
} satisfies Operation;

export const getMediaDiskSpaceHandler = async (_: Request, res: Response) => {
  try {
    const diskSpace = await getMediaDiskSpace();
    if (!diskSpace) {
      res
        .status(404)
        .json({ message: 'no disk space data for the media share' });
      return;
    }
    res.status(200).json(diskSpace);
  } catch (err) {
    console.error('GET /media/disk-space failed:', err);
    res.status(500).json({ message: 'internal server error' });
  }
};
