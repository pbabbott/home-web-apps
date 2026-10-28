import { z } from 'zod';
import {
  backupJobItemSelectSchema,
  backupJobSelectSchema,
} from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  backupNotFoundResponse,
  conflictResponse,
  humanOnlyResponse,
} from './common';
import {
  cancelBackupJobOperation,
  createBackupJobOperation,
  failBackupJobOperation,
  getBackupJobOperation,
  listBackupJobsOperation,
  planBackupJobOperation,
  rerunUnresolvedOperation,
  retryFailedBackupItemsOperation,
} from '../../controllers/backup/jobs';
import { listBackupJobItemsOperation } from '../../controllers/backup/items';
import {
  backupJobItemListQuerySchema,
  backupJobListQuerySchema,
  failBackupJobBodySchema,
  jobIdParamsSchema,
  planBackupJobBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/backup/jobs';

const itemCountsSchema = z.object({
  queued: z.number().int(),
  in_progress: z.number().int(),
  verified: z.number().int(),
  failed: z.number().int(),
  blocked: z.number().int(),
  skipped: z.number().int(),
  excluded: z.number().int(),
});

const progressSchema = z
  .object({
    itemCounts: itemCountsSchema,
    entryCounts: z.object({
      pending: z.number().int(),
      verified: z.number().int(),
      failed: z.number().int(),
      not_followed: z.number().int(),
    }),
    verifiedBytes: z.number(),
    estimatedBytes: z.number(),
    unestimatedItems: z.number().int(),
    staleClaims: z.number().int().meta({
      description:
        'In-progress items whose lease expired; the next claim reclaims them.',
    }),
    lastActivityAt: z.string().nullable().meta({ format: 'date-time' }),
  })
  .meta({ description: 'Derived from the job’s items and entries.' });

export const backupJobResponseSchema = backupJobSelectSchema.extend({
  progress: progressSchema,
});

/** A job item as the API returns it: the lease token stays with the worker. */
export const backupJobItemResponseSchema = backupJobItemSelectSchema.omit({
  claimToken: true,
});

const jobNotFound = backupNotFoundResponse('backup job');
const jobBody = (description: string) => ({
  description,
  content: { 'application/json': { schema: backupJobResponseSchema } },
});

const planItemSchema = z.object({
  inventoryItemId: z.uuid(),
  kind: z.enum(['file', 'directory']),
  rootPath: z.string(),
  destRelPath: z.string().meta({
    description:
      'Path under the source folder at the destination: `C/Users/Me`, `UNC/server/share/a`.',
  }),
  status: z.enum(['queued', 'skipped', 'excluded']),
  statusReason: z
    .enum(['already_covered', 'redundant_nested', 'excluded_by_rule'])
    .nullish(),
  estimatedSizeBytes: z.number().nullish(),
  carveOuts: z
    .array(
      z.object({
        path: z.string(),
        reason: z.enum(['rejected_item', 'exclusion_rule']),
        refId: z.uuid(),
      }),
    )
    .optional()
    .meta({
      description:
        'For a queued directory: nested rejected items and `exclude_subtree` rules that are left out of the copy.',
    }),
  coveredByInventoryItemId: z.uuid().optional(),
  coveredByRootPath: z.string().optional(),
});

export const backupPlanSchema = z.object({
  sourceId: z.uuid(),
  destinationId: z.uuid(),
  sourceDirName: z.string().meta({
    description:
      'The folder at the destination that holds this source’s files.',
  }),
  selection: z.object({
    inventoryItemIds: z.array(z.uuid()).optional(),
    pathPrefix: z.string().optional(),
    kinds: z.array(z.enum(['file', 'directory'])).optional(),
    skipAlreadyCovered: z.boolean().optional(),
  }),
  summary: z.object({
    toCopy: z.number().int(),
    skippedAlreadyCovered: z.number().int(),
    skippedRedundantNested: z.number().int(),
    excluded: z.number().int(),
    notEligible: z.number().int(),
    estimatedBytes: z.number(),
    unestimatedItems: z.number().int().meta({
      description:
        'Items to copy with no size estimate: `estimatedBytes` is a floor.',
    }),
  }),
  warnings: z.array(
    z.object({
      code: z.enum([
        'discovery_job_active',
        'destination_folder_exists',
        'destination_folder_unknown',
      ]),
      message: z.string(),
    }),
  ),
  items: z.array(planItemSchema),
  notEligible: z.array(
    z.object({
      inventoryItemId: z.uuid(),
      rootPath: z.string(),
      decision: z.enum(['pending', 'approved', 'rejected']),
      reason: z.string(),
    }),
  ),
});

const planConflicts = conflictResponse(
  'Unknown or disabled destination, an active job for this source and destination, a source folder name used by another source, or nothing to back up',
);

export const backupJobsPaths = {
  '/sources/{id}/backup-jobs/plan': {
    post: {
      summary: planBackupJobOperation.summary,
      'x-home-hud': planBackupJobOperation.hud,
      description: planBackupJobOperation.description,
      requestParams: { path: sourceIdParamsSchema, header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: planBackupJobBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The plan; nothing was written',
          content: { 'application/json': { schema: backupPlanSchema } },
        },
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': backupNotFoundResponse('source or backup destination'),
        '409': planConflicts,
      },
    },
  },
  '/sources/{id}/backup-jobs': {
    post: {
      summary: createBackupJobOperation.summary,
      'x-home-hud': createBackupJobOperation.hud,
      description: createBackupJobOperation.description,
      requestParams: { path: sourceIdParamsSchema, header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: planBackupJobBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The created job, `planned`',
          content: { 'application/json': { schema: backupJobSelectSchema } },
        },
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': backupNotFoundResponse('source or backup destination'),
        '409': planConflicts,
      },
    },
  },
  '/backup-jobs': {
    get: {
      summary: listBackupJobsOperation.summary,
      'x-home-hud': listBackupJobsOperation.hud,
      description: listBackupJobsOperation.description,
      requestParams: { query: backupJobListQuerySchema },
      responses: {
        '200': {
          description: 'The jobs, newest first',
          content: {
            'application/json': { schema: z.array(backupJobResponseSchema) },
          },
        },
        '400': validationErrorResponse,
      },
    },
  },
  '/backup-jobs/{id}': {
    get: {
      summary: getBackupJobOperation.summary,
      'x-home-hud': getBackupJobOperation.hud,
      description: getBackupJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': jobBody('The job'),
        '400': validationErrorResponse,
        '404': jobNotFound,
      },
    },
  },
  '/backup-jobs/{id}/items': {
    get: {
      summary: listBackupJobItemsOperation.summary,
      'x-home-hud': listBackupJobItemsOperation.hud,
      description: listBackupJobItemsOperation.description,
      requestParams: {
        path: jobIdParamsSchema,
        query: backupJobItemListQuerySchema,
      },
      responses: {
        '200': {
          description: 'A page of items',
          content: {
            'application/json': {
              schema: z.object({
                items: z.array(backupJobItemResponseSchema),
                next: z.string().nullable().meta({
                  description: 'Pass as `after`; null on a short page.',
                }),
              }),
            },
          },
        },
        '400': validationErrorResponse,
        '404': jobNotFound,
      },
    },
  },
  '/backup-jobs/{id}/cancel': {
    post: {
      summary: cancelBackupJobOperation.summary,
      'x-home-hud': cancelBackupJobOperation.hud,
      description: cancelBackupJobOperation.description,
      requestParams: { path: jobIdParamsSchema, header: actorHeaders },
      responses: {
        '200': jobBody('The cancelled job'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': jobNotFound,
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
  '/backup-jobs/{id}/fail': {
    post: {
      summary: failBackupJobOperation.summary,
      'x-home-hud': failBackupJobOperation.hud,
      description: failBackupJobOperation.description,
      requestParams: { path: jobIdParamsSchema, header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: failBackupJobBodySchema },
        },
      },
      responses: {
        '200': jobBody('The failed job'),
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': jobNotFound,
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
  '/backup-jobs/{id}/retry-failed': {
    post: {
      summary: retryFailedBackupItemsOperation.summary,
      'x-home-hud': retryFailedBackupItemsOperation.hud,
      description: retryFailedBackupItemsOperation.description,
      requestParams: { path: jobIdParamsSchema, header: actorHeaders },
      responses: {
        '200': {
          description: 'The requeued items',
          content: {
            'application/json': {
              schema: z.object({
                retried: z.number().int(),
                items: z.array(backupJobItemResponseSchema),
              }),
            },
          },
        },
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': jobNotFound,
        '409': conflictResponse('The job is not active'),
      },
    },
  },
  '/backup-jobs/{id}/rerun-unresolved': {
    post: {
      summary: rerunUnresolvedOperation.summary,
      'x-home-hud': rerunUnresolvedOperation.hud,
      description: rerunUnresolvedOperation.description,
      requestParams: { path: jobIdParamsSchema, header: actorHeaders },
      responses: {
        '201': {
          description: 'The new job, `planned`',
          content: { 'application/json': { schema: backupJobSelectSchema } },
        },
        '400': validationErrorResponse,
        '403': humanOnlyResponse,
        '404': jobNotFound,
        '409': planConflicts,
      },
    },
  },
};
