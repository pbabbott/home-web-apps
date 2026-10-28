import { z } from 'zod';
import { validationErrorResponse } from '../common';
import { backupNotFoundResponse } from './common';
import { getBackupCoverageOperation } from '../../controllers/backup/coverage';
import { idParamsSchema } from '../../schemas/backup/common';
import { backupCoverageQuerySchema } from '../../schemas/backup/coverage';
import { BACKUP_COVERAGE_BUCKETS } from '@abbottland/homelab-db';

const bucketSchema = z.enum(BACKUP_COVERAGE_BUCKETS);

const attemptSchema = z.object({
  jobId: z.uuid(),
  jobStatus: z.string(),
  jobItemId: z.uuid(),
  itemStatus: z.string(),
  statusReason: z.string().nullable(),
  lastError: z.string().nullable(),
  attemptCount: z.number().int(),
  updatedAt: z.string().meta({ format: 'date-time' }),
});

export const backupCoverageResponseSchema = z.object({
  sourceId: z.uuid(),
  destinationId: z.uuid(),
  source: z.object({ id: z.uuid(), name: z.string() }),
  destination: z.object({ id: z.uuid(), name: z.string() }),
  generatedAt: z.string().meta({ format: 'date-time' }),
  allAccounted: z.boolean().meta({
    description:
      'True only when no inventory item is in a blocking bucket. Read it together with `scope` and `limits`.',
  }),
  total: z.number().int(),
  counts: z.record(bucketSchema, z.number().int()),
  scope: z.string(),
  limits: z.array(z.string()),
  notes: z.object({
    keptBothFiles: z.number().int().meta({
      description: 'Verified files written under a keep-both name.',
    }),
    notFollowedEntries: z.number().int().meta({
      description:
        'Junctions and other special objects recorded, not followed.',
    }),
  }),
  discoveryReview: z.object({
    job: z
      .object({ id: z.uuid(), rootPath: z.string(), status: z.string() })
      .nullable(),
    directories: z.object({
      reviewed: z.number().int(),
      notReviewed: z.number().int(),
      unknown: z.number().int(),
      notExplored: z.number().int(),
    }),
    truncated: z.boolean(),
  }),
  omittedRejected: z.number().int(),
  items: z.array(
    z.object({
      inventoryItemId: z.uuid(),
      kind: z.enum(['file', 'directory']),
      rootPath: z.string(),
      normalizedRootPath: z.string(),
      decision: z.enum(['pending', 'approved', 'rejected']),
      bucket: bucketSchema,
      latestAttempt: attemptSchema.nullable(),
    }),
  ),
});

export const backupCoveragePaths = {
  '/sources/{id}/backup-coverage': {
    get: {
      summary: getBackupCoverageOperation.summary,
      'x-home-hud': getBackupCoverageOperation.hud,
      description: getBackupCoverageOperation.description,
      requestParams: {
        path: idParamsSchema,
        query: backupCoverageQuerySchema,
      },
      responses: {
        '200': {
          description:
            'The report. With `format=json` the same body is sent as a file download.',
          content: {
            'application/json': { schema: backupCoverageResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': backupNotFoundResponse('source or backup destination'),
      },
    },
  },
};
