import { onDiskReviewSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
} from './common';
import {
  listOnDiskReviewsOperation,
  reviewOnDiskOperation,
  unreviewOnDiskOperation,
} from '../../controllers/discovery/on-disk-reviews';
import {
  onDiskReviewListQuerySchema,
  queueItemIdParamsSchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const onDiskReviewsPaths = {
  '/queue-items/{id}/on-disk-review': {
    post: {
      summary: reviewOnDiskOperation.summary,
      'x-home-hud': reviewOnDiskOperation.hud,
      description: reviewOnDiskOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      responses: {
        '201': {
          description: 'The review',
          content: {
            'application/json': { schema: onDiskReviewSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse('The actor is not a human'),
      },
    },
    delete: {
      summary: unreviewOnDiskOperation.summary,
      'x-home-hud': unreviewOnDiskOperation.hud,
      description: unreviewOnDiskOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      responses: {
        '204': { description: 'The review was removed' },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item or review'),
        '409': conflictResponse('The actor is not a human'),
      },
    },
  },
  '/sources/{id}/on-disk-reviews': {
    get: {
      summary: listOnDiskReviewsOperation.summary,
      'x-home-hud': listOnDiskReviewsOperation.hud,
      description: listOnDiskReviewsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: onDiskReviewListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The reviewed directories',
          content: {
            'application/json': {
              schema: z.array(onDiskReviewSelectSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
};
