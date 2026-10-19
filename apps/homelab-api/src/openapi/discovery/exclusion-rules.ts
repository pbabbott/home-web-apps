import { z } from 'zod';
import { exclusionRuleSelectSchema } from '@abbottland/homelab-db';
import { validationErrorResponse } from '../common';
import {
  actorHeaders,
  conflictResponse,
  discoveryNotFoundResponse,
} from './common';
import {
  createExclusionRuleOperation,
  deleteExclusionRuleOperation,
  listExclusionRulesOperation,
  updateExclusionRuleOperation,
} from '../../controllers/discovery/exclusion-rules';
import {
  createExclusionRuleBodySchema,
  exclusionRuleIdParamsSchema,
  exclusionRuleListQuerySchema,
  updateExclusionRuleBodySchema,
} from '../../schemas/discovery';

export const exclusionRulesPaths = {
  '/exclusion-rules': {
    get: {
      summary: listExclusionRulesOperation.summary,
      description: listExclusionRulesOperation.description,
      requestParams: { query: exclusionRuleListQuerySchema },
      responses: {
        '200': {
          description: 'The rules',
          content: {
            'application/json': { schema: z.array(exclusionRuleSelectSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
    post: {
      summary: createExclusionRuleOperation.summary,
      description: createExclusionRuleOperation.description,
      requestParams: { header: actorHeaders },
      requestBody: {
        content: {
          'application/json': { schema: createExclusionRuleBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The created rule',
          content: {
            'application/json': { schema: exclusionRuleSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
        '409': conflictResponse(
          'A rule for this path already exists for the source or at the global level',
        ),
      },
    },
  },
  '/exclusion-rules/{id}': {
    patch: {
      summary: updateExclusionRuleOperation.summary,
      description: updateExclusionRuleOperation.description,
      requestParams: {
        path: exclusionRuleIdParamsSchema,
        header: actorHeaders,
      },
      requestBody: {
        content: {
          'application/json': { schema: updateExclusionRuleBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The updated rule',
          content: {
            'application/json': { schema: exclusionRuleSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('exclusion rule'),
      },
    },
    delete: {
      summary: deleteExclusionRuleOperation.summary,
      description: deleteExclusionRuleOperation.description,
      requestParams: {
        path: exclusionRuleIdParamsSchema,
        header: actorHeaders,
      },
      responses: {
        '204': { description: 'The rule was removed' },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('exclusion rule'),
      },
    },
  },
};
