import { Router } from 'express';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '@abbottland/express';
import {
  createExclusionRule,
  deleteExclusionRule,
  listExclusionRules,
  updateExclusionRule,
} from '../../controllers/discovery/exclusion-rules';
import { parseActor } from '../../lib/actor';
import {
  createExclusionRuleBodySchema,
  exclusionRuleIdParamsSchema,
  exclusionRuleListQuerySchema,
  updateExclusionRuleBodySchema,
} from '../../schemas/discovery';

export const exclusionRulesRouter = Router();

exclusionRulesRouter.get(
  '/exclusion-rules',
  validateQuery(exclusionRuleListQuerySchema),
  listExclusionRules,
);
exclusionRulesRouter.post(
  '/exclusion-rules',
  parseActor,
  validateBody(createExclusionRuleBodySchema),
  createExclusionRule,
);
exclusionRulesRouter.patch(
  '/exclusion-rules/:id',
  parseActor,
  validateParams(exclusionRuleIdParamsSchema),
  validateBody(updateExclusionRuleBodySchema),
  updateExclusionRule,
);
exclusionRulesRouter.delete(
  '/exclusion-rules/:id',
  parseActor,
  validateParams(exclusionRuleIdParamsSchema),
  deleteExclusionRule,
);
