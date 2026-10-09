import { z } from 'zod';
import { createDocument } from 'zod-openapi';
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
        summary: 'Trigger a port sync between Gluetun and qBittorrent',
        description:
          'Reads the forwarded port from Gluetun and, if it differs from qBittorrent listen_port, updates qBittorrent to match.',
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
        summary: 'Get the last recorded sync attempt/result',
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
        summary: 'Get the current public IP, as reported by ipify',
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
        summary:
          'Get the forwarded port from Gluetun and the listen_port from qBittorrent, side by side',
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
