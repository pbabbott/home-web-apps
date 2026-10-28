import { Router } from 'express';
import { validateParams, validateQuery } from '@abbottland/express';
import {
  getBackupJobItem,
  listBackupEntries,
  retryBackupJobItem,
} from '../../controllers/backup/items';
import { parseActor, requireHumanActor } from '../../lib/actor';
import { idParamsSchema } from '../../schemas/backup/common';
import { backupEntryListQuerySchema } from '../../schemas/backup/jobs';

export const backupItemsRouter = Router();

backupItemsRouter.get(
  '/backup-job-items/:id',
  validateParams(idParamsSchema),
  getBackupJobItem,
);
backupItemsRouter.get(
  '/backup-job-items/:id/entries',
  validateParams(idParamsSchema),
  validateQuery(backupEntryListQuerySchema),
  listBackupEntries,
);
backupItemsRouter.post(
  '/backup-job-items/:id/retry',
  parseActor,
  requireHumanActor,
  validateParams(idParamsSchema),
  retryBackupJobItem,
);
