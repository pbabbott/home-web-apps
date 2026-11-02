import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  cancelBackupJob,
  createBackupJob,
  failBackupJob,
  getBackupJob,
  listBackupJobs,
  planBackupJob,
  rerunUnresolved,
  retryFailedBackupItems,
} from '../../controllers/backup/jobs';
import { listBackupJobItems } from '../../controllers/backup/items';
import { parseActor, requireHumanActor } from '../../lib/actor';
import {
  backupJobItemListQuerySchema,
  backupJobListQuerySchema,
  failBackupJobBodySchema,
  jobIdParamsSchema,
  planBackupJobBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/backup/jobs';

export const backupJobsRouter = Router();

backupJobsRouter.post(
  '/sources/:id/backup-jobs/plan',
  parseActor,
  requireHumanActor,
  validateParams(sourceIdParamsSchema),
  validateBody(planBackupJobBodySchema),
  planBackupJob,
);
backupJobsRouter.post(
  '/sources/:id/backup-jobs',
  parseActor,
  requireHumanActor,
  validateParams(sourceIdParamsSchema),
  validateBody(planBackupJobBodySchema),
  createBackupJob,
);

backupJobsRouter.get(
  '/backup-jobs',
  validateQuery(backupJobListQuerySchema),
  listBackupJobs,
);
backupJobsRouter.get(
  '/backup-jobs/:id',
  validateParams(jobIdParamsSchema),
  getBackupJob,
);
backupJobsRouter.get(
  '/backup-jobs/:id/items',
  validateParams(jobIdParamsSchema),
  validateQuery(backupJobItemListQuerySchema),
  listBackupJobItems,
);
backupJobsRouter.post(
  '/backup-jobs/:id/cancel',
  parseActor,
  requireHumanActor,
  validateParams(jobIdParamsSchema),
  cancelBackupJob,
);
backupJobsRouter.post(
  '/backup-jobs/:id/fail',
  parseActor,
  requireHumanActor,
  validateParams(jobIdParamsSchema),
  validateBody(failBackupJobBodySchema),
  failBackupJob,
);
backupJobsRouter.post(
  '/backup-jobs/:id/retry-failed',
  parseActor,
  requireHumanActor,
  validateParams(jobIdParamsSchema),
  retryFailedBackupItems,
);
backupJobsRouter.post(
  '/backup-jobs/:id/rerun-unresolved',
  parseActor,
  requireHumanActor,
  validateParams(jobIdParamsSchema),
  rerunUnresolved,
);
