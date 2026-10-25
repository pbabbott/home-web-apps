import { skipAcknowledgementSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
} from './common';
import {
  acknowledgeSkipOperation,
  listSkipAcknowledgementsOperation,
  unacknowledgeSkipOperation,
} from '../../controllers/discovery/skip-acknowledgements';
import {
  queueItemIdParamsSchema,
  skipAcknowledgementBodySchema,
  skipAcknowledgementListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const skipAcknowledgementsPaths = {
  '/queue-items/{id}/skip-acknowledgements': {
    post: {
      summary: acknowledgeSkipOperation.summary,
      'x-home-hud': acknowledgeSkipOperation.hud,
      description: acknowledgeSkipOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: skipAcknowledgementBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The acknowledgement',
          content: {
            'application/json': { schema: skipAcknowledgementSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item'),
        '409': conflictResponse(
          'The actor is not a human, or the path is outside the queue item’s directory',
        ),
      },
    },
    delete: {
      summary: unacknowledgeSkipOperation.summary,
      'x-home-hud': unacknowledgeSkipOperation.hud,
      description: unacknowledgeSkipOperation.description,
      requestParams: {
        path: queueItemIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: skipAcknowledgementBodySchema },
        },
      },
      responses: {
        '204': { description: 'The acknowledgement was removed' },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('queue item or acknowledgement'),
        '409': conflictResponse(
          'The actor is not a human, or the path is outside the queue item’s directory',
        ),
      },
    },
  },
  '/sources/{id}/skip-acknowledgements': {
    get: {
      summary: listSkipAcknowledgementsOperation.summary,
      'x-home-hud': listSkipAcknowledgementsOperation.hud,
      description: listSkipAcknowledgementsOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: skipAcknowledgementListQuerySchema,
      },
      responses: {
        '200': {
          description: 'The acknowledged skips',
          content: {
            'application/json': {
              schema: z.array(skipAcknowledgementSelectSchema),
            },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
  },
};
