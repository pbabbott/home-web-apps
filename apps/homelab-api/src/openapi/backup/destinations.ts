import { z } from 'zod';
import { backupDestinationSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  backupNotFoundResponse,
  conflictResponse,
  humanOnlyResponse,
} from './common';
import {
  createBackupDestinationOperation,
  disableBackupDestinationOperation,
  enableBackupDestinationOperation,
  getBackupDestinationOperation,
  listBackupDestinationsOperation,
  updateBackupDestinationOperation,
  validateBackupDestinationOperation,
} from '../../controllers/backup/destinations';
import { idParamsSchema } from '../../schemas/backup/common';
import {
  createBackupDestinationBodySchema,
  updateBackupDestinationBodySchema,
} from '../../schemas/backup/destinations';

export const backupDestinationResponseSchema =
  backupDestinationSelectSchema.extend({
    workerStale: z.boolean().meta({
      description:
        'No worker has polled recently (or ever): a validation request would not run.',
    }),
  });

const destinationBody = (description: string) => ({
  description,
  content: {
    'application/json': { schema: backupDestinationResponseSchema },
  },
});

const notFound = backupNotFoundResponse('backup destination');

export const backupDestinationsPaths = {
  '/backup-destinations': {
    get: {
      summary: listBackupDestinationsOperation.summary,
      'x-home-hud': listBackupDestinationsOperation.hud,
      description: listBackupDestinationsOperation.description,
      responses: {
        '200': {
          description: 'The destinations',
          content: {
            'application/json': {
              schema: z.array(backupDestinationResponseSchema),
            },
          },
        },
      },
    },
    post: {
      summary: createBackupDestinationOperation.summary,
      'x-home-hud': createBackupDestinationOperation.hud,
      description: createBackupDestinationOperation.description,
      requestParams: { header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: createBackupDestinationBodySchema },
        },
      },
      responses: {
        '201': destinationBody('The created destination'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '409': conflictResponse('A destination with this name already exists'),
      },
    },
  },
  '/backup-destinations/{id}': {
    get: {
      summary: getBackupDestinationOperation.summary,
      'x-home-hud': getBackupDestinationOperation.hud,
      requestParams: { path: idParamsSchema },
      responses: {
        '200': destinationBody('The destination'),
        '400': validationErrorResponse,
        '404': notFound,
      },
    },
    patch: {
      summary: updateBackupDestinationOperation.summary,
      'x-home-hud': updateBackupDestinationOperation.hud,
      description: updateBackupDestinationOperation.description,
      requestParams: { path: idParamsSchema, header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: updateBackupDestinationBodySchema },
        },
      },
      responses: {
        '200': destinationBody('The updated destination'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': notFound,
        '409': conflictResponse(
          'The name is taken, or the destination has an active job or verified data and its settings or rootDir would change',
        ),
      },
    },
  },
  '/backup-destinations/{id}/validate': {
    post: {
      summary: validateBackupDestinationOperation.summary,
      'x-home-hud': validateBackupDestinationOperation.hud,
      description: validateBackupDestinationOperation.description,
      requestParams: { path: idParamsSchema, header: actorHeaders },
      responses: {
        '202': destinationBody(
          'The request was recorded; the worker validates asynchronously',
        ),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': notFound,
      },
    },
  },
  '/backup-destinations/{id}/enable': {
    post: {
      summary: enableBackupDestinationOperation.summary,
      'x-home-hud': enableBackupDestinationOperation.hud,
      description: enableBackupDestinationOperation.description,
      requestParams: { path: idParamsSchema, header: actorHeaders },
      responses: {
        '200': destinationBody('The enabled destination'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': notFound,
      },
    },
  },
  '/backup-destinations/{id}/disable': {
    post: {
      summary: disableBackupDestinationOperation.summary,
      'x-home-hud': disableBackupDestinationOperation.hud,
      description: disableBackupDestinationOperation.description,
      requestParams: { path: idParamsSchema, header: actorHeaders },
      responses: {
        '200': destinationBody('The disabled destination'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': notFound,
      },
    },
  },
};
