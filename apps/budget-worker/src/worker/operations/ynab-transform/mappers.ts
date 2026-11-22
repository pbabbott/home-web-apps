import type {
  YnabPlanEndpoint,
  YnabPlanRow,
  YnabTransformRows,
} from '@abbottland/budget-db';

/**
 * Pure functions from a raw YNAB response body to typed rows. No DB access,
 * so they are unit-tested against fixture payloads. A payload missing a
 * required field throws, failing the job with the offending raw response id
 * rather than storing a half-typed row.
 */

type Json = Record<string, unknown>;

export type MapContext = { planId: string; rawResponseId: string };

const list = (body: unknown, key: string): Json[] => {
  const value = (body as { data?: Json } | null)?.data?.[key];

  return Array.isArray(value) ? (value as Json[]) : [];
};

const str = (row: Json, key: string): string | null =>
  typeof row[key] === 'string' ? (row[key] as string) : null;

const num = (row: Json, key: string): number | null =>
  typeof row[key] === 'number' ? (row[key] as number) : null;

const bool = (row: Json, key: string): boolean | null =>
  typeof row[key] === 'boolean' ? (row[key] as boolean) : null;

const required = <T>(
  row: Json,
  key: string,
  read: (r: Json, k: string) => T | null,
): T => {
  const value = read(row, key);

  if (value === null) {
    throw new Error(`missing or invalid "${key}" in YNAB payload`);
  }

  return value;
};

const date = (value: string | null): Date | null =>
  value ? new Date(value) : null;

const lineage = (row: Json, ctx: MapContext) => ({
  planId: ctx.planId,
  deleted: row.deleted === true,
  lastRawResponseId: ctx.rawResponseId,
});

export const mapPlans = (body: unknown, rawResponseId: string): YnabPlanRow[] =>
  list(body, 'plans').map((p) => ({
    id: required(p, 'id', str),
    name: required(p, 'name', str),
    lastModifiedOn: date(str(p, 'last_modified_on')),
    firstMonth: str(p, 'first_month'),
    lastMonth: str(p, 'last_month'),
    lastRawResponseId: rawResponseId,
  }));

const mapAccounts = (body: unknown, ctx: MapContext): YnabTransformRows => ({
  accounts: list(body, 'accounts').map((a) => ({
    ...lineage(a, ctx),
    id: required(a, 'id', str),
    name: required(a, 'name', str),
    type: required(a, 'type', str),
    onBudget: required(a, 'on_budget', bool),
    closed: required(a, 'closed', bool),
    note: str(a, 'note'),
    balance: required(a, 'balance', num),
    clearedBalance: required(a, 'cleared_balance', num),
    unclearedBalance: required(a, 'uncleared_balance', num),
    transferPayeeId: str(a, 'transfer_payee_id'),
    directImportLinked: bool(a, 'direct_import_linked'),
    directImportInError: bool(a, 'direct_import_in_error'),
    lastReconciledAt: date(str(a, 'last_reconciled_at')),
  })),
});

const mapCategories = (body: unknown, ctx: MapContext): YnabTransformRows => {
  const groups = list(body, 'category_groups');

  return {
    categoryGroups: groups.map((g) => ({
      ...lineage(g, ctx),
      id: required(g, 'id', str),
      name: required(g, 'name', str),
      hidden: required(g, 'hidden', bool),
    })),
    categories: groups.flatMap((g) =>
      ((g.categories as Json[] | undefined) ?? []).map((c) => ({
        ...lineage(c, ctx),
        id: required(c, 'id', str),
        categoryGroupId: str(c, 'category_group_id') ?? required(g, 'id', str),
        name: required(c, 'name', str),
        hidden: required(c, 'hidden', bool),
        note: str(c, 'note'),
        budgeted: required(c, 'budgeted', num),
        activity: required(c, 'activity', num),
        balance: required(c, 'balance', num),
        goalType: str(c, 'goal_type'),
        goalTarget: num(c, 'goal_target'),
        goalTargetMonth: str(c, 'goal_target_month'),
        goalPercentageComplete: num(c, 'goal_percentage_complete'),
        goalCadence: num(c, 'goal_cadence'),
        goalCadenceFrequency: num(c, 'goal_cadence_frequency'),
      })),
    ),
  };
};

const mapPayees = (body: unknown, ctx: MapContext): YnabTransformRows => ({
  payees: list(body, 'payees').map((p) => ({
    ...lineage(p, ctx),
    id: required(p, 'id', str),
    name: required(p, 'name', str),
    transferAccountId: str(p, 'transfer_account_id'),
  })),
});

const mapTransactions = (body: unknown, ctx: MapContext): YnabTransformRows => {
  const transactions = list(body, 'transactions');

  return {
    transactions: transactions.map((t) => ({
      ...lineage(t, ctx),
      id: required(t, 'id', str),
      date: required(t, 'date', str),
      amount: required(t, 'amount', num),
      memo: str(t, 'memo'),
      cleared: required(t, 'cleared', str),
      approved: required(t, 'approved', bool),
      flagColor: str(t, 'flag_color'),
      flagName: str(t, 'flag_name'),
      accountId: required(t, 'account_id', str),
      payeeId: str(t, 'payee_id'),
      categoryId: str(t, 'category_id'),
      transferAccountId: str(t, 'transfer_account_id'),
      transferTransactionId: str(t, 'transfer_transaction_id'),
      matchedTransactionId: str(t, 'matched_transaction_id'),
      importId: str(t, 'import_id'),
      importPayeeName: str(t, 'import_payee_name'),
      importPayeeNameOriginal: str(t, 'import_payee_name_original'),
      debtTransactionType: str(t, 'debt_transaction_type'),
    })),
    subtransactions: transactions.flatMap((t) =>
      ((t.subtransactions as Json[] | undefined) ?? []).map((s) => ({
        ...lineage(s, ctx),
        id: required(s, 'id', str),
        transactionId: str(s, 'transaction_id') ?? required(t, 'id', str),
        amount: required(s, 'amount', num),
        memo: str(s, 'memo'),
        payeeId: str(s, 'payee_id'),
        categoryId: str(s, 'category_id'),
        transferAccountId: str(s, 'transfer_account_id'),
        transferTransactionId: str(s, 'transfer_transaction_id'),
      })),
    ),
  };
};

const mapScheduledTransactions = (
  body: unknown,
  ctx: MapContext,
): YnabTransformRows => {
  const scheduled = list(body, 'scheduled_transactions');

  return {
    scheduledTransactions: scheduled.map((t) => ({
      ...lineage(t, ctx),
      id: required(t, 'id', str),
      dateFirst: required(t, 'date_first', str),
      dateNext: required(t, 'date_next', str),
      frequency: required(t, 'frequency', str),
      amount: required(t, 'amount', num),
      memo: str(t, 'memo'),
      flagColor: str(t, 'flag_color'),
      flagName: str(t, 'flag_name'),
      accountId: required(t, 'account_id', str),
      payeeId: str(t, 'payee_id'),
      categoryId: str(t, 'category_id'),
      transferAccountId: str(t, 'transfer_account_id'),
    })),
    scheduledSubtransactions: scheduled.flatMap((t) =>
      ((t.subtransactions as Json[] | undefined) ?? []).map((s) => ({
        ...lineage(s, ctx),
        id: required(s, 'id', str),
        scheduledTransactionId:
          str(s, 'scheduled_transaction_id') ?? required(t, 'id', str),
        amount: required(s, 'amount', num),
        memo: str(s, 'memo'),
        payeeId: str(s, 'payee_id'),
        categoryId: str(s, 'category_id'),
        transferAccountId: str(s, 'transfer_account_id'),
      })),
    ),
  };
};

const mapMonths = (body: unknown, ctx: MapContext): YnabTransformRows => {
  const months = list(body, 'months');

  return {
    months: months.map((m) => ({
      ...lineage(m, ctx),
      month: required(m, 'month', str),
      note: str(m, 'note'),
      income: required(m, 'income', num),
      budgeted: required(m, 'budgeted', num),
      activity: required(m, 'activity', num),
      toBeBudgeted: required(m, 'to_be_budgeted', num),
      ageOfMoney: num(m, 'age_of_money'),
    })),
    monthCategories: months.flatMap((m) =>
      ((m.categories as Json[] | undefined) ?? []).map((c) => ({
        ...lineage(c, ctx),
        month: required(m, 'month', str),
        categoryId: required(c, 'id', str),
        budgeted: required(c, 'budgeted', num),
        activity: required(c, 'activity', num),
        balance: required(c, 'balance', num),
      })),
    ),
  };
};

export const mappers: Record<
  YnabPlanEndpoint,
  (body: unknown, ctx: MapContext) => YnabTransformRows
> = {
  accounts: mapAccounts,
  categories: mapCategories,
  payees: mapPayees,
  transactions: mapTransactions,
  scheduled_transactions: mapScheduledTransactions,
  months: mapMonths,
};
