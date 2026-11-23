import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * A saved rule: selects transactions by account / payee / amount range and
 * carries the actions the nightly `apply_filter_selections` job performs on
 * the unapproved ones. Filters match by YNAB id (robust to renames). Amounts
 * are signed milliunits: outflows are negative.
 */
export const budgetFilterSelections = pgTable('budget_filter_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  planId: text('plan_id').notNull(),
  accountId: text('account_id'),
  payeeId: text('payee_id'),
  amountMinMilliunits: bigint('amount_min_milliunits', { mode: 'number' }),
  amountMaxMilliunits: bigint('amount_max_milliunits', { mode: 'number' }),
  categoryId: text('category_id'),
  autoApprove: boolean('auto_approve').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BudgetFilterSelection = typeof budgetFilterSelections.$inferSelect;
export type NewBudgetFilterSelection =
  typeof budgetFilterSelections.$inferInsert;

export const FILTER_AUDIT_ACTIONS = ['categorize', 'approve'] as const;
export type FilterAuditAction = (typeof FILTER_AUDIT_ACTIONS)[number];

export const FILTER_AUDIT_STATUSES = [
  'applied',
  'skipped_conflict',
  'failed',
] as const;
export type FilterAuditStatus = (typeof FILTER_AUDIT_STATUSES)[number];

/**
 * Append-only log of every automatic action (or skipped/failed attempt).
 * Rows are never updated. `rule_description` is text frozen at apply time, so
 * later edits (or deletion) of the rule never rewrite history; there is
 * deliberately no foreign key to the rule.
 */
export const budgetFilterSelectionAudit = pgTable(
  'budget_filter_selection_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appliedAt: timestamp('applied_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    jobId: uuid('job_id'),
    filterSelectionId: uuid('filter_selection_id'),
    ruleName: text('rule_name').notNull(),
    ruleDescription: text('rule_description').notNull(),
    ruleSnapshot: jsonb('rule_snapshot').notNull(),
    planId: text('plan_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    transactionDate: text('transaction_date').notNull(),
    transactionAmount: bigint('transaction_amount', {
      mode: 'number',
    }).notNull(),
    accountName: text('account_name'),
    payeeName: text('payee_name'),
    action: text('action').$type<FilterAuditAction>().notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    status: text('status').$type<FilterAuditStatus>().notNull(),
    error: text('error'),
  },
  (table) => [
    index('budget_filter_audit_applied_at_idx').on(table.appliedAt),
    index('budget_filter_audit_transaction_idx').on(
      table.planId,
      table.transactionId,
    ),
  ],
);

export type BudgetFilterSelectionAudit =
  typeof budgetFilterSelectionAudit.$inferSelect;
export type NewBudgetFilterSelectionAudit =
  typeof budgetFilterSelectionAudit.$inferInsert;
