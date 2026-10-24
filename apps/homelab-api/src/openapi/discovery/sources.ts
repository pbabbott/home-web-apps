import { validationErrorResponse } from '../common';
import {
  conflictResponse,
  discoveryJobResponseSchema,
  discoveryNotFoundResponse,
} from './common';
import {
  createDiscoveryJobOperation,
  listSourceJobsOperation,
} from '../../controllers/discovery/discovery-jobs';
import {
  createSourceOperation,
  listSourcesOperation,
  updateSourceOperation,
} from '../../controllers/discovery/sources';
import {
  createDiscoveryJobBodySchema,
  createSourceBodySchema,
  sourceIdParamsSchema,
  updateSourceBodySchema,
} from '../../schemas/discovery';
import {
  discoveryJobSelectSchema,
  sourceSelectSchema,
} from '@abbottland/homelab-db';
import { z } from 'zod';

export const sourcesPaths = {
  '/sources': {
    get: {
      summary: listSourcesOperation.summary,
      'x-home-hud': listSourcesOperation.hud,
      responses: {
        '200': {
          description: 'The sources',
          content: {
            'application/json': { schema: z.array(sourceSelectSchema) },
          },
        },
      },
    },
    post: {
      summary: createSourceOperation.summary,
      'x-home-hud': createSourceOperation.hud,
      requestBody: {
        content: {
          'application/json': { schema: createSourceBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The created source',
          content: {
            'application/json': { schema: sourceSelectSchema },
          },
        },
        '400': validationErrorResponse,
        '409': conflictResponse('A source with this name already exists'),
      },
    },
  },
  '/sources/{id}': {
    patch: {
      summary: updateSourceOperation.summary,
      'x-home-hud': updateSourceOperation.hud,
      description: updateSourceOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: updateSourceBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The updated source',
          content: { 'application/json': { schema: sourceSelectSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source or host'),
        '409': conflictResponse('A source with this name already exists'),
      },
    },
  },
  '/sources/{id}/discovery-jobs': {
    get: {
      summary: listSourceJobsOperation.summary,
      tags: ['Discovery Jobs'],
      'x-home-hud': listSourceJobsOperation.hud,
      description: listSourceJobsOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      responses: {
        '200': {
          description: 'The jobs',
          content: {
            'application/json': { schema: z.array(discoveryJobSelectSchema) },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
      },
    },
    post: {
      summary: createDiscoveryJobOperation.summary,
      tags: ['Discovery Jobs'],
      'x-home-hud': createDiscoveryJobOperation.hud,
      description: createDiscoveryJobOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: createDiscoveryJobBodySchema },
        },
      },
      responses: {
        '201': {
          description: 'The pending job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
        '409': conflictResponse('The source already has an active job'),
      },
    },
  },
};
