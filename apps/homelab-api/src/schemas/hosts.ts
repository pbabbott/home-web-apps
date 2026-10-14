import { z } from 'zod';

export const hostTypeSchema = z.enum(['physical', 'virtual']);

export const hostListQuerySchema = z.object({
  type: hostTypeSchema.optional().meta({
    description: 'Filter to just physical or virtual hosts. Omit for both.',
    example: 'physical',
  }),
});

export type HostListQuery = z.infer<typeof hostListQuerySchema>;

export const hostIdParamsSchema = z.object({
  id: z.uuid(),
});

export type HostIdParams = z.infer<typeof hostIdParamsSchema>;

export const createHostBodySchema = z.object({
  name: z.string().min(1).meta({ example: 'tf-prod-k8s-worker-1' }),
  ipAddress: z.string().min(1).meta({ example: '10.0.0.11' }),
  hostType: hostTypeSchema.default('physical'),
  /**
   * Matches the `instance` label Prometheus stamps on node-exporter metrics
   * (scrape-target address:port) so this host's uptime/cpu can be enriched.
   * Optional — a host can be registered before (or without) node-exporter
   * scraping it.
   */
  instance: z.string().min(1).optional().meta({
    example: '192.168.6.24:9100',
  }),
  /**
   * Slug of a procedural 3D model (home-hud's /infra/viz/models/<slug>/)
   * to render in this host's detail panel. Free text, not an enum — the
   * valid-slug set is a frontend concern (the UI only offers real slugs
   * in its picker), not something this API validates against.
   */
  model3d: z.string().min(1).optional().meta({
    example: 'nas',
  }),
});

export type CreateHostBody = z.infer<typeof createHostBodySchema>;

export const updateHostBodySchema = z.object({
  name: z.string().min(1).optional().meta({ example: 'tf-prod-k8s-worker-1' }),
  ipAddress: z.string().min(1).optional().meta({ example: '10.0.0.11' }),
  hostType: hostTypeSchema.optional(),
  instance: z.string().min(1).nullable().optional().meta({
    example: '192.168.6.24:9100',
  }),
  model3d: z.string().min(1).nullable().optional().meta({
    example: 'nas',
  }),
});

export type UpdateHostBody = z.infer<typeof updateHostBodySchema>;

/** Shared by every /hosts/:id/metrics/<metric> route — the range/step shape doesn't vary per metric. */
export const hostMetricsRangeQuerySchema = z.object({
  rangeSeconds: z.coerce.number().int().positive().default(3600).meta({
    description: 'How far back (seconds) the history should cover.',
    example: 3600,
  }),
  stepSeconds: z.coerce.number().int().positive().default(30).meta({
    description: 'Resolution (seconds) between returned data points.',
    example: 30,
  }),
});

export type HostMetricsRangeQuery = z.infer<typeof hostMetricsRangeQuerySchema>;
