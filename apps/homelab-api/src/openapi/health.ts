import { z } from 'zod';

export const healthPaths = {
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
};
