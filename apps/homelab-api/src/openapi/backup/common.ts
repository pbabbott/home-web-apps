import { z } from 'zod';

export { actorHeaders } from '../discovery/common';
export { conflictResponse } from '../discovery/common';

export const backupNotFoundResponse = (what: string) => ({
  description: `No ${what} exists with this id`,
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: `${what} not found` }),
      }),
    },
  },
});

export const humanOnlyResponse = {
  description: 'Backup actions are human-only (X-Actor-Type must be human)',
  content: {
    'application/json': {
      schema: z.object({
        message: z.string().meta({ example: 'backup actions are human-only' }),
      }),
    },
  },
};
