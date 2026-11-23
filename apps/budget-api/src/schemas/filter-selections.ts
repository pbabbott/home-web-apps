import { z } from 'zod';

const milliunits = z.number().int().meta({
  description:
    'Signed amount in YNAB milliunits (1000 = 1.00); outflows are negative',
  example: -2500000,
});

const filterFields = {
  accountId: z.string().min(1).nullish(),
  payeeId: z.string().min(1).nullish(),
  amountMinMilliunits: milliunits.nullish(),
  amountMaxMilliunits: milliunits.nullish(),
};

type FilterFields = {
  accountId?: string | null;
  payeeId?: string | null;
  amountMinMilliunits?: number | null;
  amountMaxMilliunits?: number | null;
};

const hasFilter = (f: FilterFields) =>
  f.accountId != null ||
  f.payeeId != null ||
  f.amountMinMilliunits != null ||
  f.amountMaxMilliunits != null;

const rangeOk = (f: FilterFields) =>
  f.amountMinMilliunits == null ||
  f.amountMaxMilliunits == null ||
  f.amountMinMilliunits <= f.amountMaxMilliunits;

/** Filters only, used by the preview. At least one filter is required. */
export const previewBodySchema = z
  .object({ planId: z.string().min(1), ...filterFields })
  .refine(hasFilter, { message: 'at least one filter is required' })
  .refine(rangeOk, { message: 'amount min must be <= amount max' });

export const filterSelectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    planId: z.string().min(1),
    ...filterFields,
    categoryId: z.string().min(1).nullish(),
    autoApprove: z.boolean().default(false),
  })
  .refine(hasFilter, { message: 'at least one filter is required' })
  .refine(rangeOk, { message: 'amount min must be <= amount max' })
  .refine((v) => v.categoryId != null || v.autoApprove, {
    message: 'choose at least one action (categorize or auto approve)',
  });

export type FilterSelectionBody = z.infer<typeof filterSelectionBodySchema>;
export type PreviewBody = z.infer<typeof previewBodySchema>;

export const filterSelectionIdParamsSchema = z.object({
  id: z.uuid('id must be a valid UUID'),
});

export const listAuditQuerySchema = z.object({
  filterSelectionId: z.uuid().optional(),
  status: z.enum(['applied', 'skipped_conflict', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

export const referenceQuerySchema = z.object({
  planId: z.string().min(1),
});

export type ReferenceQuery = z.infer<typeof referenceQuerySchema>;
