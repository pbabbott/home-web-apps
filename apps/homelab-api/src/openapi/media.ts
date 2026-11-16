import { z } from 'zod';
import { getMediaDiskSpaceOperation } from '../controllers/media/disk-space';

export const mediaDiskSpaceSchema = z.object({
  host: z.string().meta({ example: 'room_of_requirement' }),
  mountpoint: z.string().meta({ example: '/share/Media' }),
  totalBytes: z.number(),
  usedBytes: z.number(),
  availableBytes: z.number(),
  usedRatio: z.number().meta({ description: 'usedBytes / totalBytes, 0-1' }),
});

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
          content: {
            'application/json': { schema: z.object({ message: z.string() }) },
          },
        },
      },
    },
  },
};
