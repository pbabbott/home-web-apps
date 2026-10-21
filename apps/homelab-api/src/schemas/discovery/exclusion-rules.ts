import { z } from 'zod';
import { windowsPathSchema } from './common';

export const exclusionRuleIdParamsSchema = z.object({ id: z.uuid() });
export type ExclusionRuleIdParams = z.infer<typeof exclusionRuleIdParamsSchema>;

const exclusionRuleScopeSchema = z.enum(['selective_only', 'exclude_subtree']);

export const createExclusionRuleBodySchema = z.object({
  sourceId: z.uuid().nullable().default(null).meta({
    description: 'The source the rule applies to. Null or omitted = global.',
  }),
  path: windowsPathSchema,
  scope: exclusionRuleScopeSchema.meta({
    description:
      '`exclude_subtree`: skip the path and everything beneath it. `selective_only`: the path is not a backup inventory item itself, but its contents are still explored.',
  }),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type CreateExclusionRuleBody = z.infer<
  typeof createExclusionRuleBodySchema
>;

export const updateExclusionRuleBodySchema = z
  .object({
    scope: exclusionRuleScopeSchema.optional(),
    reason: z.string().trim().min(1).max(500).nullable().optional().meta({
      description: 'Null clears the reason.',
    }),
  })
  .refine((body) => body.scope !== undefined || body.reason !== undefined, {
    message: 'provide scope and/or reason',
  });
export type UpdateExclusionRuleBody = z.infer<
  typeof updateExclusionRuleBodySchema
>;

export const exclusionRuleListQuerySchema = z.object({
  sourceId: z.uuid().optional().meta({
    description: 'Only this source’s rules plus the global ones.',
  }),
  scope: exclusionRuleScopeSchema.optional(),
});
export type ExclusionRuleListQuery = z.infer<
  typeof exclusionRuleListQuerySchema
>;
