import { z } from 'zod';

export const auditEventListQuerySchema = z.object({
  sourceId: z.uuid().optional(),
  jobId: z.uuid().optional(),
  inventoryItemId: z.uuid().optional().meta({
    description: 'Includes bulk reviews that changed this item.',
  }),
  exclusionRuleId: z.uuid().optional(),
  eventType: z
    .enum([
      'exclusion_rule.created',
      'exclusion_rule.updated',
      'exclusion_rule.deleted',
      'inventory_item.review_changed',
      'inventory_item.review_bulk_changed',
      'queue_items.excluded',
    ])
    .optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  before: z.uuid().optional().meta({
    description: 'Cursor: the id of the last event of the previous page.',
  }),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type AuditEventListQuery = z.infer<typeof auditEventListQuerySchema>;
