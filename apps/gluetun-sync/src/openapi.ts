import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import { getPortsOperation } from './controllers/get-ports';
import { getPublicIpOperation } from './controllers/get-public-ip';
import { getStatusOperation } from './controllers/get-status';
import { doSyncOperation } from './controllers/sync-ports';
import { SyncCaller } from './data';

const syncCallerSchema = z.enum(SyncCaller);

const statusRecordSchema = z.object({
  lastCronStart: z.coerce.date().optional(),
  lastCronEnd: z.coerce.date().optional(),
  lastSuccess: z.coerce.date().optional(),
  lastFailure: z.coerce.date().optional(),
  lastFailureMessage: z.string().optional(),
  lastAttempt: z.coerce.date().optional(),
  lastAttemptBy: syncCallerSchema.optional(),
  mostRecentAttemptSuccessful: z.boolean().optional(),
});

export const openApiSpec = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'gluetun-sync',
    version: '0.1.1',
    description:
      'Keeps the qBittorrent listen port in sync with the forwarded port Gluetun gets from PIA.',
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
    '/sync': {
      post: {
        summary: doSyncOperation.summary,
        description: doSyncOperation.description,
        responses: {
          '200': {
            description: 'Sync succeeded (ports now match, or already did)',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
          '502': {
            description: 'Sync failed talking to Gluetun or qBittorrent',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
    },
    '/status': {
      get: {
        summary: getStatusOperation.summary,
        responses: {
          '200': {
            description: 'Current in-memory status record',
            content: {
              'application/json': {
                schema: z.object({ result: statusRecordSchema }),
              },
            },
          },
        },
      },
    },
    '/status/public-ip': {
      get: {
        summary: getPublicIpOperation.summary,
        responses: {
          '200': {
            description: 'Public IP lookup succeeded',
            content: {
              'application/json': {
                schema: z.object({ result: z.object({ ip: z.string() }) }),
              },
            },
          },
          '503': {
            description: 'Could not reach ipify',
            content: {
              'application/json': {
                schema: z.object({ message: z.string() }),
              },
            },
          },
        },
      },
    },
    '/status/ports': {
      get: {
        summary: getPortsOperation.summary,
        responses: {
          '200': {
            description:
              'Current ports (either may be null if that service could not be reached)',
            content: {
              'application/json': {
                schema: z.object({
                  result: z.object({
                    gluetunPort: z.string().nullable(),
                    qbitTorrentPort: z.string().nullable(),
                  }),
                }),
              },
            },
          },
        },
      },
    },
  },
});
