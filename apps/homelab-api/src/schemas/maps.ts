import { z } from 'zod';

// Only "pods" exists today, but the param is already an enum so adding
// "deployments"/"nodes" later is a one-line change here plus a branch in
// the controller — not a route rename.
export const mapTypeParamsSchema = z.object({
  type: z.enum(['pods']),
});

export type MapTypeParams = z.infer<typeof mapTypeParamsSchema>;

export const mapQuerySchema = z.object({
  metric: z.enum(['cpu', 'memory', 'both']).meta({
    description: 'Which usage metric(s) drive each item’s status',
    example: 'cpu',
  }),
  groupBy: z.enum(['namespace', 'node', 'workload']).optional().meta({
    description:
      'Optional dimension to group items by. Omit for a single ungrouped map.',
    example: 'namespace',
  }),
});

export type MapQuery = z.infer<typeof mapQuerySchema>;
