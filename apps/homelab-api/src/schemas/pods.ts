import { z } from 'zod';

export const podMetricsParamsSchema = z.object({
  namespace: z.string().min(1),
  pod: z.string().min(1),
});

export type PodMetricsParams = z.infer<typeof podMetricsParamsSchema>;

/** Same shape as hosts' range/step query — kept as its own schema since a pod isn't a host. */
export const podMetricsRangeQuerySchema = z.object({
  rangeSeconds: z.coerce.number().int().positive().default(3600).meta({
    description: 'How far back (seconds) the history should cover.',
    example: 3600,
  }),
  stepSeconds: z.coerce.number().int().positive().default(30).meta({
    description: 'Resolution (seconds) between returned data points.',
    example: 30,
  }),
});

export type PodMetricsRangeQuery = z.infer<typeof podMetricsRangeQuerySchema>;
