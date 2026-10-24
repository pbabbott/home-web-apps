import { sourceConnectionSelectSchema } from '@abbottland/homelab-db';
import { z } from 'zod';
import { validationErrorResponse } from '../common';
import { conflictResponse, discoveryNotFoundResponse } from './common';
import {
  deleteSourceConnectionOperation,
  getSourceConnectionOperation,
  previewSourceFileOperation,
  saveSourceConnectionOperation,
  testSourceConnectionOperation,
} from '../../controllers/discovery/source-connections';
import {
  previewQuerySchema,
  saveSourceConnectionBodySchema,
  sourceIdParamsSchema,
} from '../../schemas/discovery';

const connectionResponseSchema = sourceConnectionSelectSchema.extend({
  hasPassword: z.literal(true),
});

const messageResponse = (description: string) => ({
  description,
  content: {
    'application/json': { schema: z.object({ message: z.string() }) },
  },
});

export const sourceConnectionsPaths = {
  '/sources/{id}/connection': {
    get: {
      summary: getSourceConnectionOperation.summary,
      'x-home-hud': getSourceConnectionOperation.hud,
      description: getSourceConnectionOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      responses: {
        '200': {
          description: 'The connection',
          content: { 'application/json': { schema: connectionResponseSchema } },
        },
        '404': discoveryNotFoundResponse('source or connection'),
      },
    },
    put: {
      summary: saveSourceConnectionOperation.summary,
      'x-home-hud': saveSourceConnectionOperation.hud,
      description: saveSourceConnectionOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      requestBody: {
        content: {
          'application/json': { schema: saveSourceConnectionBodySchema },
        },
      },
      responses: {
        '200': {
          description: 'The saved connection',
          content: { 'application/json': { schema: connectionResponseSchema } },
        },
        '400': validationErrorResponse,
        '404': discoveryNotFoundResponse('source'),
        '409': conflictResponse(
          'A password is required to create a connection',
        ),
        '503': messageResponse('EXODUS_CREDENTIAL_KEY is not configured'),
      },
    },
    delete: {
      summary: deleteSourceConnectionOperation.summary,
      'x-home-hud': deleteSourceConnectionOperation.hud,
      requestParams: { path: sourceIdParamsSchema },
      responses: {
        '204': { description: 'Deleted' },
        '404': discoveryNotFoundResponse('connection'),
      },
    },
  },
  '/sources/{id}/connection/test': {
    post: {
      summary: testSourceConnectionOperation.summary,
      'x-home-hud': testSourceConnectionOperation.hud,
      description: testSourceConnectionOperation.description,
      requestParams: { path: sourceIdParamsSchema },
      responses: {
        '200': {
          description: 'The connection with its new test result',
          content: { 'application/json': { schema: connectionResponseSchema } },
        },
        '404': discoveryNotFoundResponse('source or connection'),
        '409': conflictResponse('The source is not linked to a host'),
        '503': messageResponse('EXODUS_CREDENTIAL_KEY is not configured'),
      },
    },
  },
  '/sources/{id}/preview': {
    get: {
      summary: previewSourceFileOperation.summary,
      'x-home-hud': previewSourceFileOperation.hud,
      description: previewSourceFileOperation.description,
      requestParams: {
        path: sourceIdParamsSchema,
        query: previewQuerySchema,
      },
      responses: {
        '200': {
          description: 'The file',
          content: {
            'image/*': { schema: z.string().meta({ format: 'binary' }) },
            'application/pdf': {
              schema: z.string().meta({ format: 'binary' }),
            },
            'text/plain': { schema: z.string() },
          },
        },
        '400': validationErrorResponse,
        '403': messageResponse('The path is not part of the source'),
        '404': discoveryNotFoundResponse('source, connection or file'),
        '409': conflictResponse('The source is not linked to a host'),
        '413': messageResponse('The file is too large to preview'),
        '415': messageResponse('The file type cannot be previewed'),
        '502': messageResponse('The source could not be read'),
        '503': messageResponse('EXODUS_CREDENTIAL_KEY is not configured'),
      },
    },
  },
};
