import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { ynabLineageColumns } from './ynab-lineage';

/** Money columns are YNAB milliunits (1000 = 1 currency unit), kept exact. */
const milliunits = (name: string) => bigint(name, { mode: 'number' });

/** Typed current state of the `plans` response (no deltas, so no soft delete). */
export const ynabPlans = pgTable('ynab_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lastModifiedOn: timestamp('last_modified_on', { withTimezone: true }),
  firstMonth: date('first_month', { mode: 'string' }),
  lastMonth: date('last_month', { mode: 'string' }),
  lastRawResponseId: uuid('last_raw_response_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ynabAccounts = pgTable(
  'ynab_accounts',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    onBudget: boolean('on_budget').notNull(),
    closed: boolean('closed').notNull(),
    note: text('note'),
    balance: milliunits('balance').notNull(),
    clearedBalance: milliunits('cleared_balance').notNull(),
    unclearedBalance: milliunits('uncleared_balance').notNull(),
    transferPayeeId: text('transfer_payee_id'),
    directImportLinked: boolean('direct_import_linked'),
    directImportInError: boolean('direct_import_in_error'),
    lastReconciledAt: timestamp('last_reconciled_at', { withTimezone: true }),
    ...ynabLineageColumns,
  },
  (table) => [primaryKey({ columns: [table.planId, table.id] })],
);

export const ynabCategoryGroups = pgTable(
  'ynab_category_groups',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    hidden: boolean('hidden').notNull(),
    ...ynabLineageColumns,
  },
  (table) => [primaryKey({ columns: [table.planId, table.id] })],
);

export const ynabCategories = pgTable(
  'ynab_categories',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    categoryGroupId: text('category_group_id').notNull(),
    name: text('name').notNull(),
    hidden: boolean('hidden').notNull(),
    note: text('note'),
    budgeted: milliunits('budgeted').notNull(),
    activity: milliunits('activity').notNull(),
    balance: milliunits('balance').notNull(),
    goalType: text('goal_type'),
    goalTarget: milliunits('goal_target'),
    goalTargetMonth: date('goal_target_month', { mode: 'string' }),
    goalPercentageComplete: integer('goal_percentage_complete'),
    goalCadence: integer('goal_cadence'),
    goalCadenceFrequency: integer('goal_cadence_frequency'),
    ...ynabLineageColumns,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.id] }),
    index('ynab_categories_group_idx').on(table.planId, table.categoryGroupId),
  ],
);

export const ynabPayees = pgTable(
  'ynab_payees',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    transferAccountId: text('transfer_account_id'),
    ...ynabLineageColumns,
  },
  (table) => [primaryKey({ columns: [table.planId, table.id] })],
);

export type YnabPlanRow = typeof ynabPlans.$inferInsert;
export type YnabAccountRow = typeof ynabAccounts.$inferInsert;
export type YnabCategoryGroupRow = typeof ynabCategoryGroups.$inferInsert;
export type YnabCategoryRow = typeof ynabCategories.$inferInsert;
export type YnabPayeeRow = typeof ynabPayees.$inferInsert;
