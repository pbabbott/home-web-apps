import { Router } from 'express';
import { validateBody, validateParams } from '@abbottland/express';
import {
  createBackupDestination,
  disableBackupDestination,
  enableBackupDestination,
  getBackupDestination,
  listBackupDestinations,
  updateBackupDestination,
  validateBackupDestination,
} from '../../controllers/backup/destinations';
import { parseActor, requireHumanActor } from '../../lib/actor';
import { idParamsSchema } from '../../schemas/backup/common';
import {
  createBackupDestinationBodySchema,
  updateBackupDestinationBodySchema,
} from '../../schemas/backup/destinations';

export const backupDestinationsRouter = Router();

backupDestinationsRouter.get('/backup-destinations', listBackupDestinations);
backupDestinationsRouter.post(
  '/backup-destinations',
  parseActor,
  requireHumanActor,
  validateBody(createBackupDestinationBodySchema),
  createBackupDestination,
);
backupDestinationsRouter.get(
  '/backup-destinations/:id',
  validateParams(idParamsSchema),
  getBackupDestination,
);
backupDestinationsRouter.patch(
  '/backup-destinations/:id',
  parseActor,
  requireHumanActor,
  validateParams(idParamsSchema),
  validateBody(updateBackupDestinationBodySchema),
  updateBackupDestination,
);
backupDestinationsRouter.post(
  '/backup-destinations/:id/validate',
  parseActor,
  requireHumanActor,
  validateParams(idParamsSchema),
  validateBackupDestination,
);
backupDestinationsRouter.post(
  '/backup-destinations/:id/enable',
  parseActor,
  requireHumanActor,
  validateParams(idParamsSchema),
  enableBackupDestination,
);
backupDestinationsRouter.post(
  '/backup-destinations/:id/disable',
  parseActor,
  requireHumanActor,
  validateParams(idParamsSchema),
  disableBackupDestination,
);
