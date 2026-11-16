import { z } from 'zod';

export const MAX_LOG_TAIL = 1000;

export const logsQuerySchema = z.object({
  tail: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LOG_TAIL)
    .default(200)
    .meta({
      description: `How many of the most recent log lines to return (max ${MAX_LOG_TAIL}).`,
      example: 200,
    }),
});

export type LogsQuery = z.infer<typeof logsQuerySchema>;
