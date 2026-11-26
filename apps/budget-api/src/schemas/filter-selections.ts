import { z } from 'zod';
import { PAYEE_MATCH_TYPES } from '@abbottland/budget-db';

const milliunits = z.number().int().meta({
  description:
    'Signed amount in YNAB milliunits (1000 = 1.00); outflows are negative',
  example: -2500000,
});

const filterFields = {
  accountId: z.string().min(1).nullish(),
  payeeId: z.string().min(1).nullish(),
  payeeMatchType: z.enum(PAYEE_MATCH_TYPES).nullish().meta({
    description:
      'How payeePattern is compared with the payee name (case-insensitive). Use with payeePattern instead of payeeId',
  }),
  payeePattern: z.string().trim().min(1).max(100).nullish().meta({
    description: 'Text matched against the payee name, e.g. "Royal"',
  }),
  amountMinMilliunits: milliunits.nullish(),
  amountMaxMilliunits: milliunits.nullish(),
};

type FilterFields = {
  accountId?: string | null;
  payeeId?: string | null;
  payeeMatchType?: string | null;
  payeePattern?: string | null;
  amountMinMilliunits?: number | null;
  amountMaxMilliunits?: number | null;
};

const hasFilter = (f: FilterFields) =>
  f.accountId != null ||
  f.payeeId != null ||
  f.payeePattern != null ||
  f.amountMinMilliunits != null ||
  f.amountMaxMilliunits != null;

const payeeOk = (f: FilterFields) =>
  (f.payeePattern == null) === (f.payeeMatchType == null) &&
  !(f.payeePattern != null && f.payeeId != null);

const rangeOk = (f: FilterFields) =>
  f.amountMinMilliunits == null ||
  f.amountMaxMilliunits == null ||
  f.amountMinMilliunits <= f.amountMaxMilliunits;

/** Filters only, used by the preview. At least one filter is required. */
export const previewBodySchema = z
  .object({ planId: z.string().min(1), ...filterFields })
  .refine(hasFilter, { message: 'at least one filter is required' })
  .refine(payeeOk, {
    message: 'payeePattern and payeeMatchType go together and exclude payeeId',
  })
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
  .refine(payeeOk, {
    message: 'payeePattern and payeeMatchType go together and exclude payeeId',
  })
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
  status: z
    .enum(['applied', 'skipped_conflict', 'unchanged', 'failed'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

export const referenceQuerySchema = z.object({
  planId: z.string().min(1),
});

export type ReferenceQuery = z.infer<typeof referenceQuerySchema>;

const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

export const listCandidatesQuerySchema = z.object({
  planId: z.string().min(1),
  unapprovedOnly: booleanQuery,
  includeCovered: booleanQuery,
});

export type ListCandidatesQuery = z.infer<typeof listCandidatesQuerySchema>;
