import { z } from 'zod';
import { backupEntrySelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  backupNotFoundResponse,
  conflictResponse,
  humanOnlyResponse,
} from './common';
import { backupJobItemResponseSchema } from './jobs';
import {
  getBackupJobItemOperation,
  listBackupEntriesOperation,
  retryBackupJobItemOperation,
} from '../../controllers/backup/items';
import { idParamsSchema } from '../../schemas/backup/common';
import { backupEntryListQuerySchema } from '../../schemas/backup/jobs';

const itemNotFound = backupNotFoundResponse('backup job item');

export const backupItemsPaths = {
  '/backup-job-items/{id}': {
    get: {
      summary: getBackupJobItemOperation.summary,
      'x-home-hud': getBackupJobItemOperation.hud,
      description: getBackupJobItemOperation.description,
      requestParams: { path: idParamsSchema },
      responses: {
        '200': {
          description: 'The item',
          content: {
            'application/json': {
              schema: backupJobItemResponseSchema.extend({
                entryCounts: z.object({
                  pending: z.number().int(),
                  verified: z.number().int(),
                  failed: z.number().int(),
                  not_followed: z.number().int(),
                  verifiedBytes: z.number(),
                }),
              }),
            },
          },
        },
        '400': validationErrorResponse,
        '404': itemNotFound,
      },
    },
  },
  '/backup-job-items/{id}/entries': {
    get: {
      summary: listBackupEntriesOperation.summary,
      'x-home-hud': listBackupEntriesOperation.hud,
      description: listBackupEntriesOperation.description,
      requestParams: {
        path: idParamsSchema,
        query: backupEntryListQuerySchema,
      },
      responses: {
        '200': {
          description: 'A page of entries',
          content: {
            'application/json': {
              schema: z.object({
                entries: z.array(backupEntrySelectSchema),
                next: z.number().int().nullable().meta({
                  description: 'Pass as `after`; null on a short page.',
                }),
              }),
            },
          },
        },
        '400': validationErrorResponse,
        '404': itemNotFound,
      },
    },
  },
  '/backup-job-items/{id}/retry': {
    post: {
      summary: retryBackupJobItemOperation.summary,
      'x-home-hud': retryBackupJobItemOperation.hud,
      description: retryBackupJobItemOperation.description,
      requestParams: { path: idParamsSchema, header: actorHeaders },
      responses: {
        '200': {
          description: 'The requeued item',
          content: {
            'application/json': { schema: backupJobItemResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': itemNotFound,
        '409': conflictResponse(
          'The item is not failed or blocked, or its job is not active',
        ),
      },
    },
  },
};
