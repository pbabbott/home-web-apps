import { validationErrorResponse } from '../common';
import {
  conflictResponse,
  discoveryJobResponseSchema,
  discoveryJobWithSourceSchema,
  discoveryNotFoundResponse,
} from './common';
import {
  cancelDiscoveryJobOperation,
  completeDiscoveryJobOperation,
  failDiscoveryJobOperation,
  getDiscoveryJobOperation,
  listDiscoveryJobsOperation,
} from '../../controllers/discovery/discovery-jobs';
import {
  failDiscoveryJobBodySchema,
  jobIdParamsSchema,
  jobListQuerySchema,
} from '../../schemas/discovery';
import { z } from 'zod';

export const discoveryJobsPaths = {
  '/discovery-jobs': {
    get: {
      summary: listDiscoveryJobsOperation.summary,
      description: listDiscoveryJobsOperation.description,
      requestParams: { query: jobListQuerySchema },
      responses: {
        '200': {
          description: 'The jobs',
          content: {
            'application/json': {
              schema: z.array(discoveryJobWithSourceSchema),
            },
          },
        },
        '400': validationErrorResponse,
      },
    },
  },
  '/discovery-jobs/{id}': {
    get: {
      summary: getDiscoveryJobOperation.summary,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
      },
    },
  },
  '/discovery-jobs/{id}/complete': {
    post: {
      summary: completeDiscoveryJobOperation.summary,
      description: completeDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The completed job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('Work remains, or the job is already finished'),
      },
    },
  },
  '/discovery-jobs/{id}/cancel': {
    post: {
      summary: cancelDiscoveryJobOperation.summary,
      description: cancelDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      responses: {
        '200': {
          description: 'The cancelled job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
  '/discovery-jobs/{id}/fail': {
    post: {
      summary: failDiscoveryJobOperation.summary,
      description: failDiscoveryJobOperation.description,
      requestParams: { path: jobIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: failDiscoveryJobBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The failed job',
          content: {
            'application/json': { schema: discoveryJobResponseSchema },
          },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('discovery job'),
        '409': conflictResponse('The job is already finished'),
      },
    },
  },
};
