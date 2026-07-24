import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import {
  fileRenameSelectSchema,
  titleCardSelectSchema,
  videoJobSelectSchema,
} from '@abbottland/video-db';
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
} from './schemas/jobs';
import { browseQuerySchema } from './schemas/browse';
import { hashQuerySchema } from './schemas/hash';
import {
  createTitleCardSchema,
  listTitleCardsQuerySchema,
  titleCardIdParamsSchema,
} from './schemas/title-cards';
import {
  createFileRenameSchema,
  fileRenameIdParamsSchema,
  listFileRenamesQuerySchema,
  updateFileRenameStatusSchema,
} from './schemas/file-renames';

const validationErrorSchema = z.object({
  message: z.string().meta({ example: 'Invalid request body' }),
  errors: z.array(
    z.object({
      field: z.string().meta({ example: 'inputPath' }),
      message: z.string().meta({ example: 'inputPath is required' }),
    }),
  ),
});

const validationErrorResponse = {
  description: 'One or more fields are missing or invalid',
  content: {
    'application/json': { schema: validationErrorSchema },
  },
};

const browseEntrySchema = z.object({
  name: z.string(),
  type: z.enum(['directory', 'file']),
});

/**
 * Generated from the Zod schemas that already validate these routes'
 * requests (src/schemas/*.ts) and from video-db's videoJobSelectSchema
 * (itself derived from the video_jobs table) — so this can't drift from
 * what the API actually accepts/returns the way a hand-written spec can.
 */
export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'video-api',
    version: '0.1.0',
    description:
      'Queues video-processing jobs (Postgres-backed) for a separate video-worker.',
  },
  paths: {
    '/healthz': {
      get: {
        summary: 'Liveness check',
        responses: {
          '200': {
            description: 'Process is up',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
        },
      },
    },
    '/readyz': {
      get: {
        summary: 'Readiness check',
        description: 'Confirms PostgreSQL is reachable.',
        responses: {
          '200': {
            description: 'Postgres is reachable',
            content: {
              'application/json': {
                schema: z.object({ status: z.literal('ok') }),
              },
            },
          },
          '503': {
            description: 'Postgres is unreachable',
            content: {
              'application/json': {
                schema: z.object({
                  status: z.literal('error'),
                  message: z.string(),
                }),
              },
            },
          },
        },
      },
    },
    '/jobs': {
      get: {
        summary: 'List jobs, optionally filtered by status',
        requestParams: { query: listJobsQuerySchema },
        responses: {
          '200': {
            description: 'Matching jobs, most recently created first',
            content: {
              'application/json': {
                schema: z.object({ jobs: z.array(videoJobSelectSchema) }),
              },
            },
          },
          '400': validationErrorResponse,
        },
      },
      post: {
        summary: 'Create a video-processing job',
        requestBody: {
          content: { 'application/json': { schema: createJobSchema } },
        },
        responses: {
          '201': {
            description: 'Job created',
            content: {
              'application/json': {
                schema: z.object({
                  jobId: z.uuid(),
                  status: z.literal('pending'),
                }),
              },
            },
          },
          '400': validationErrorResponse,
        },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Fetch a job status/result',
        requestParams: { path: jobIdParamsSchema },
        responses: {
          '200': {
            description: 'The job record',
            content: { 'application/json': { schema: videoJobSelectSchema } },
          },
          '400': validationErrorResponse,
          '404': { description: 'No job with that id' },
        },
      },
    },
    '/browse': {
      get: {
        summary: 'List files/folders under MEDIA_ROOT',
        description:
          'path is resolved relative to, and constrained within, MEDIA_ROOT. Requests that attempt to traverse outside of it get a 400.',
        requestParams: { query: browseQuerySchema },
        responses: {
          '200': {
            description: 'Directory listing',
            content: {
              'application/json': {
                schema: z.object({
                  path: z.string(),
                  entries: z.array(browseEntrySchema),
                }),
              },
            },
          },
          '400': {
            description: 'path escapes MEDIA_ROOT or is not a directory',
          },
          '404': { description: 'path does not exist' },
        },
      },
    },
    '/hash': {
      get: {
        summary: 'Compute the SHA-256 hash of a video file',
        description:
          'Resolves filePath within MEDIA_ROOT and hashes it the same way POST /title-cards and POST /file-renames do internally — useful for getting a fileHash up front to use as a lookup key against those routes.',
        requestParams: { query: hashQuerySchema },
        responses: {
          '200': {
            description: 'The computed hash',
            content: {
              'application/json': {
                schema: z.object({
                  filePath: z.string(),
                  fileHash: z.string(),
                }),
              },
            },
          },
          '400': {
            description: 'filePath escapes MEDIA_ROOT',
          },
          '404': { description: 'filePath does not exist' },
        },
      },
    },
    '/title-cards': {
      get: {
        summary: 'List recorded title cards, optionally filtered by file',
        description:
          'Pass fileHash to look up by a previously-returned hash directly, or filePath to have the server resolve+hash it the same way POST does. Omit both to list everything (capped at 100, ordered by timestampSeconds).',
        requestParams: { query: listTitleCardsQuerySchema },
        responses: {
          '200': {
            description: 'Matching title cards, ordered by timestampSeconds',
            content: {
              'application/json': {
                schema: z.object({
                  titleCards: z.array(titleCardSelectSchema),
                }),
              },
            },
          },
          '400': {
            description: 'filePath escapes MEDIA_ROOT',
          },
          '404': { description: 'filePath does not exist' },
        },
      },
      post: {
        summary: 'Record the timestamp a title card was found at',
        description:
          'The video file at filePath is hashed (SHA-256) server-side; the hash, not filePath, is the identity used to key this record, so it stays valid if the file is later renamed. Re-submitting the same filePath/timestampSeconds pair updates the existing record instead of erroring.',
        requestBody: {
          content: { 'application/json': { schema: createTitleCardSchema } },
        },
        responses: {
          '201': {
            description: 'Title card recorded (created or updated)',
            content: {
              'application/json': { schema: titleCardSelectSchema },
            },
          },
          '400': validationErrorResponse,
          '404': { description: 'filePath does not exist' },
        },
      },
    },
    '/title-cards/{id}': {
      get: {
        summary: 'Fetch a recorded title card',
        requestParams: { path: titleCardIdParamsSchema },
        responses: {
          '200': {
            description: 'The title card record',
            content: { 'application/json': { schema: titleCardSelectSchema } },
          },
          '400': validationErrorResponse,
          '404': { description: 'No title card with that id' },
        },
      },
    },
    '/file-renames': {
      get: {
        summary: 'List suggested renames, optionally filtered by file/status',
        description:
          'Pass fileHash to look up by a previously-returned hash directly, or filePath (the original path) to have the server resolve+hash it the same way POST does. status further filters to pending/applied/rejected. Omit all to list everything (capped at 100, most recently suggested first).',
        requestParams: { query: listFileRenamesQuerySchema },
        responses: {
          '200': {
            description: 'Matching rename suggestions, newest first',
            content: {
              'application/json': {
                schema: z.object({
                  fileRenames: z.array(fileRenameSelectSchema),
                }),
              },
            },
          },
          '400': {
            description: 'filePath escapes MEDIA_ROOT',
          },
          '404': { description: 'filePath does not exist' },
        },
      },
      post: {
        summary: 'Suggest a destination filename for a video file',
        description:
          'originalFilePath is hashed (SHA-256) server-side; the hash, not the path, is the identity used to key this record, so it stays valid if the file is later renamed again. suggestedFilePath is only checked for path traversal — it is not expected to exist yet, since nothing renames the file automatically. Re-submitting for the same file updates the existing suggestion instead of erroring.',
        requestBody: {
          content: { 'application/json': { schema: createFileRenameSchema } },
        },
        responses: {
          '201': {
            description: 'Rename suggestion recorded (created or updated)',
            content: {
              'application/json': { schema: fileRenameSelectSchema },
            },
          },
          '400': validationErrorResponse,
          '404': { description: 'originalFilePath does not exist' },
        },
      },
    },
    '/file-renames/{id}': {
      get: {
        summary: 'Fetch a suggested rename',
        requestParams: { path: fileRenameIdParamsSchema },
        responses: {
          '200': {
            description: 'The rename suggestion record',
            content: {
              'application/json': { schema: fileRenameSelectSchema },
            },
          },
          '400': validationErrorResponse,
          '404': { description: 'No rename suggestion with that id' },
        },
      },
      patch: {
        summary: 'Mark the outcome of a rename suggestion',
        description:
          'Sets status to pending/applied/rejected. applied stamps appliedAt with the current time; the other two clear it. This does not rename anything on disk — it only records whether the rename was carried out.',
        requestParams: { path: fileRenameIdParamsSchema },
        requestBody: {
          content: {
            'application/json': { schema: updateFileRenameStatusSchema },
          },
        },
        responses: {
          '200': {
            description: 'Updated rename suggestion record',
            content: {
              'application/json': { schema: fileRenameSelectSchema },
            },
          },
          '400': validationErrorResponse,
          '404': { description: 'No rename suggestion with that id' },
        },
      },
    },
  },
});
