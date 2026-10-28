import { Router } from 'express';
import { validateBody, validateParams } from '@abbottland/express';
import { createBackupJob, planBackupJob } from '../../controllers/backup/jobs';
import { parseActor, requireHumanActor } from '../../lib/actor';
import {
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
