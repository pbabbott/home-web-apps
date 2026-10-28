import { z } from 'zod';
import { backupJobSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  backupNotFoundResponse,
  conflictResponse,
  humanOnlyResponse,
} from './common';
import {
  createBackupJobOperation,
  planBackupJobOperation,
} from '../../controllers/backup/jobs';
import {
  planBackupJobBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/backup/jobs';

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
};
