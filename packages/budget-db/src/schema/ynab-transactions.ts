import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';
import { ynabLineageColumns } from './ynab-lineage';

const milliunits = (name: string) => bigint(name, { mode: 'number' });

export const ynabTransactions = pgTable(
  'ynab_transactions',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    amount: milliunits('amount').notNull(),
    memo: text('memo'),
    cleared: text('cleared').notNull(),
    approved: boolean('approved').notNull(),
    flagColor: text('flag_color'),
    flagName: text('flag_name'),
    accountId: text('account_id').notNull(),
    payeeId: text('payee_id'),
    categoryId: text('category_id'),
    transferAccountId: text('transfer_account_id'),
    transferTransactionId: text('transfer_transaction_id'),
    matchedTransactionId: text('matched_transaction_id'),
    importId: text('import_id'),
    importPayeeName: text('import_payee_name'),
    importPayeeNameOriginal: text('import_payee_name_original'),
    debtTransactionType: text('debt_transaction_type'),
    ...ynabLineageColumns,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.id] }),
    index('ynab_transactions_date_idx').on(table.planId, table.date),
    index('ynab_transactions_account_idx').on(table.planId, table.accountId),
    index('ynab_transactions_payee_idx').on(table.planId, table.payeeId),
    index('ynab_transactions_category_idx').on(table.planId, table.categoryId),
  ],
);

/** Split lines of a transaction; replaced wholesale whenever the parent is applied. */
export const ynabSubtransactions = pgTable(
  'ynab_subtransactions',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    transactionId: text('transaction_id').notNull(),
    amount: milliunits('amount').notNull(),
    memo: text('memo'),
    payeeId: text('payee_id'),
    categoryId: text('category_id'),
    transferAccountId: text('transfer_account_id'),
    transferTransactionId: text('transfer_transaction_id'),
    ...ynabLineageColumns,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.id] }),
    index('ynab_subtransactions_parent_idx').on(
      table.planId,
      table.transactionId,
    ),
  ],
);

export const ynabScheduledTransactions = pgTable(
  'ynab_scheduled_transactions',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    dateFirst: date('date_first', { mode: 'string' }).notNull(),
    dateNext: date('date_next', { mode: 'string' }).notNull(),
    frequency: text('frequency').notNull(),
    amount: milliunits('amount').notNull(),
    memo: text('memo'),
    flagColor: text('flag_color'),
    flagName: text('flag_name'),
    accountId: text('account_id').notNull(),
    payeeId: text('payee_id'),
    categoryId: text('category_id'),
    transferAccountId: text('transfer_account_id'),
    ...ynabLineageColumns,
  },
  (table) => [primaryKey({ columns: [table.planId, table.id] })],
);

export const ynabScheduledSubtransactions = pgTable(
  'ynab_scheduled_subtransactions',
  {
    planId: text('plan_id').notNull(),
    id: text('id').notNull(),
    scheduledTransactionId: text('scheduled_transaction_id').notNull(),
    amount: milliunits('amount').notNull(),
    memo: text('memo'),
    payeeId: text('payee_id'),
    categoryId: text('category_id'),
    transferAccountId: text('transfer_account_id'),
    ...ynabLineageColumns,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.id] }),
    index('ynab_scheduled_subtransactions_parent_idx').on(
      table.planId,
      table.scheduledTransactionId,
    ),
  ],
);

export type YnabTransactionRow = typeof ynabTransactions.$inferInsert;
export type YnabSubtransactionRow = typeof ynabSubtransactions.$inferInsert;
export type YnabScheduledTransactionRow =
  typeof ynabScheduledTransactions.$inferInsert;
export type YnabScheduledSubtransactionRow =
  typeof ynabScheduledSubtransactions.$inferInsert;
