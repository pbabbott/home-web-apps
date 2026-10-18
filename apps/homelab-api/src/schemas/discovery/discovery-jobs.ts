import { z } from 'zod';
import { windowsPathSchema } from './common';

export const jobIdParamsSchema = z.object({ id: z.uuid() });
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;

export const createDiscoveryJobBodySchema = z.object({
  rootPath: windowsPathSchema.meta({
    description: 'Directory the job starts from; queued as the first item.',
  }),
});
export type CreateDiscoveryJobBody = z.infer<
  typeof createDiscoveryJobBodySchema
>;

export const failDiscoveryJobBodySchema = z.object({
  error: z.string().min(1).meta({ example: 'agent lost access to the share' }),
});
export type FailDiscoveryJobBody = z.infer<typeof failDiscoveryJobBodySchema>;

export const jobListQuerySchema = z.object({
  sourceId: z.uuid().optional().meta({
    description: 'Only this source’s jobs. Omit for all jobs.',
  }),
});
export type JobListQuery = z.infer<typeof jobListQuerySchema>;
