import {
  bigint,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';
import { ynabLineageColumns } from './ynab-lineage';

const milliunits = (name: string) => bigint(name, { mode: 'number' });

export const ynabMonths = pgTable(
  'ynab_months',
  {
    planId: text('plan_id').notNull(),
    /** First day of the month (YNAB sends e.g. 2026-11-01). */
    month: date('month', { mode: 'string' }).notNull(),
    note: text('note'),
    income: milliunits('income').notNull(),
    budgeted: milliunits('budgeted').notNull(),
    activity: milliunits('activity').notNull(),
    toBeBudgeted: milliunits('to_be_budgeted').notNull(),
    ageOfMoney: integer('age_of_money'),
    ...ynabLineageColumns,
  },
  (table) => [primaryKey({ columns: [table.planId, table.month] })],
);

/** A category's budgeted/activity/balance within one month. */
export const ynabMonthCategories = pgTable(
  'ynab_month_categories',
  {
    planId: text('plan_id').notNull(),
    month: date('month', { mode: 'string' }).notNull(),
    categoryId: text('category_id').notNull(),
    budgeted: milliunits('budgeted').notNull(),
    activity: milliunits('activity').notNull(),
    balance: milliunits('balance').notNull(),
    ...ynabLineageColumns,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.month, table.categoryId] }),
  ],
);

export type YnabMonthRow = typeof ynabMonths.$inferInsert;
export type YnabMonthCategoryRow = typeof ynabMonthCategories.$inferInsert;
