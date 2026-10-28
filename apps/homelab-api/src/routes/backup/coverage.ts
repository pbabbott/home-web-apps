import { Router } from 'express';
import { validateParams, validateQuery } from '@abbottland/express';
import { getBackupCoverage } from '../../controllers/backup/coverage';
import { idParamsSchema } from '../../schemas/backup/common';
import { backupCoverageQuerySchema } from '../../schemas/backup/coverage';

export const backupCoverageRouter = Router();

backupCoverageRouter.get(
  '/sources/:id/backup-coverage',
  validateParams(idParamsSchema),
  validateQuery(backupCoverageQuerySchema),
  getBackupCoverage,
);
