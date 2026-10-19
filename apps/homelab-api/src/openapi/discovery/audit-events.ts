import { z } from 'zod';
import { auditEventSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import { listAuditEventsOperation } from '../../controllers/discovery/audit-events';
import { auditEventListQuerySchema } from '../../schemas/discovery';

export const auditEventsPaths = {
  '/audit-events': {
    get: {
      summary: listAuditEventsOperation.summary,
      description: listAuditEventsOperation.description,
      requestParams: { query: auditEventListQuerySchema },
      responses: {
        '200': {
          description: 'The audit events, newest first',
          content: {
            'application/json': { schema: z.array(auditEventSelectSchema) },
          },
        },
        '400': validationErrorResponse,
      },
    },
  },
};
