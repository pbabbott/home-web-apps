import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  acknowledgeSkip,
  listSkipAcknowledgements,
  unacknowledgeSkip,
} from '../../controllers/discovery/skip-acknowledgements';
import { parseActor } from '../../lib/actor';
import {
  queueItemIdParamsSchema,
  skipAcknowledgementBodySchema,
  skipAcknowledgementListQuerySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

export const skipAcknowledgementsRouter = Router();

skipAcknowledgementsRouter.post(
  '/queue-items/:id/skip-acknowledgements',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  validateBody(skipAcknowledgementBodySchema),
  acknowledgeSkip,
);
skipAcknowledgementsRouter.delete(
  '/queue-items/:id/skip-acknowledgements',
  parseActor,
  validateParams(queueItemIdParamsSchema),
  validateBody(skipAcknowledgementBodySchema),
  unacknowledgeSkip,
);
skipAcknowledgementsRouter.get(
  '/sources/:id/skip-acknowledgements',
  validateParams(sourceIdParamsSchema),
  validateQuery(skipAcknowledgementListQuerySchema),
  listSkipAcknowledgements,
);
