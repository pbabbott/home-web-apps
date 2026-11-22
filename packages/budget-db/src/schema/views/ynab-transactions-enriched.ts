import { and, eq, sql } from 'drizzle-orm';
import { pgView } from 'drizzle-orm/pg-core';
import {
  ynabAccounts,
  ynabCategories,
  ynabCategoryGroups,
  ynabPayees,
} from '../ynab-entities';
import { ynabSubtransactions, ynabTransactions } from '../ynab-transactions';

/**
 * First "mart": live transactions with names joined in and amounts in
 * currency units. Reads only typed tables, never raw JSON; new marts follow
 * the same shape (see docs/budget/ynab-tables.md).
 */
export const ynabTransactionsEnriched = pgView('ynab_transactions_enriched').as(
  (qb) =>
    qb
      .select({
        planId: ynabTransactions.planId,
        id: ynabTransactions.id,
        date: ynabTransactions.date,
        amountUnits: sql<string>`${ynabTransactions.amount} / 1000.0`.as(
          'amount_units',
        ),
        memo: ynabTransactions.memo,
        cleared: ynabTransactions.cleared,
        approved: ynabTransactions.approved,
        accountId: ynabTransactions.accountId,
        accountName: sql<string | null>`${ynabAccounts.name}`.as(
          'account_name',
        ),
        payeeId: ynabTransactions.payeeId,
        payeeName: sql<string | null>`${ynabPayees.name}`.as('payee_name'),
        categoryId: ynabTransactions.categoryId,
        categoryName: sql<string | null>`${ynabCategories.name}`.as(
          'category_name',
        ),
        categoryGroupName: sql<string | null>`${ynabCategoryGroups.name}`.as(
          'category_group_name',
        ),
        isTransfer:
          sql<boolean>`${ynabTransactions.transferAccountId} is not null`.as(
            'is_transfer',
          ),
        isSplit: sql<boolean>`exists (
        select 1 from ${ynabSubtransactions}
        where ${ynabSubtransactions.planId} = ${ynabTransactions.planId}
          and ${ynabSubtransactions.transactionId} = ${ynabTransactions.id}
          and not ${ynabSubtransactions.deleted}
      )`.as('is_split'),
      })
      .from(ynabTransactions)
      .leftJoin(
        ynabAccounts,
        and(
          eq(ynabAccounts.planId, ynabTransactions.planId),
          eq(ynabAccounts.id, ynabTransactions.accountId),
        ),
      )
      .leftJoin(
        ynabPayees,
        and(
          eq(ynabPayees.planId, ynabTransactions.planId),
          eq(ynabPayees.id, ynabTransactions.payeeId),
        ),
      )
      .leftJoin(
        ynabCategories,
        and(
          eq(ynabCategories.planId, ynabTransactions.planId),
          eq(ynabCategories.id, ynabTransactions.categoryId),
        ),
      )
      .leftJoin(
        ynabCategoryGroups,
        and(
          eq(ynabCategoryGroups.planId, ynabCategories.planId),
          eq(ynabCategoryGroups.id, ynabCategories.categoryGroupId),
        ),
      )
      .where(eq(ynabTransactions.deleted, false)),
);
