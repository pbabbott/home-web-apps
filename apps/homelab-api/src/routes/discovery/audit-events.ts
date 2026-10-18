import { Router } from 'express';
import { validateQuery } from '@abbottland/express';
import { listAuditEvents } from '../../controllers/discovery/audit-events';
import { auditEventListQuerySchema } from '../../schemas/discovery';

export const auditEventsRouter = Router();

auditEventsRouter.get(
  '/audit-events',
  validateQuery(auditEventListQuerySchema),
  listAuditEvents,
);
