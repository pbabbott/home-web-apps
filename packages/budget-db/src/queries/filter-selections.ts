import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../client';
import type { FilterSelectionFilters } from '../filter-selection-rules';
import {
  budgetFilterSelectionAudit,
  budgetFilterSelections,
  type BudgetFilterSelection,
  type BudgetFilterSelectionAudit,
  type FilterAuditStatus,
  type NewBudgetFilterSelection,
  type NewBudgetFilterSelectionAudit,
} from '../schema/budget-filter-selections';
import {
  ynabAccounts,
  ynabCategories,
  ynabCategoryGroups,
  ynabPayees,
} from '../schema/ynab-entities';
import { ynabTransactionsEnriched as enriched } from '../schema/views/ynab-transactions-enriched';

export type FilterSelectionInput = Omit<
  NewBudgetFilterSelection,
  'id' | 'createdAt' | 'updatedAt'
>;

export const createFilterSelection = async (
  db: Database,
  input: FilterSelectionInput,
): Promise<BudgetFilterSelection> => {
  const [row] = await db
    .insert(budgetFilterSelections)
    .values(input)
    .returning();

  return row;
};

export const updateFilterSelection = async (
  db: Database,
  id: string,
  input: FilterSelectionInput,
): Promise<BudgetFilterSelection | undefined> => {
  const [row] = await db
    .update(budgetFilterSelections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(budgetFilterSelections.id, id))
    .returning();

  return row;
};

export const deleteFilterSelection = async (
  db: Database,
  id: string,
): Promise<boolean> => {
  const rows = await db
    .delete(budgetFilterSelections)
    .where(eq(budgetFilterSelections.id, id))
    .returning({ id: budgetFilterSelections.id });

  return rows.length > 0;
};

export const getFilterSelection = async (
  db: Database,
  id: string,
): Promise<BudgetFilterSelection | undefined> => {
  const [row] = await db
    .select()
    .from(budgetFilterSelections)
    .where(eq(budgetFilterSelections.id, id));

  return row;
};

export const listFilterSelections = async (
  db: Database,
  options: { enabledOnly?: boolean; planId?: string } = {},
): Promise<BudgetFilterSelection[]> =>
  db
    .select()
    .from(budgetFilterSelections)
    .where(
      and(
        options.enabledOnly
          ? eq(budgetFilterSelections.enabled, true)
          : undefined,
        options.planId
          ? eq(budgetFilterSelections.planId, options.planId)
          : undefined,
      ),
    )
    .orderBy(asc(budgetFilterSelections.name));

/**
 * The single place filters become SQL, shared by the preview and the apply
 * job so the preview is exactly what the job will match.
 */
export const filterConditions = (
  planId: string,
  filters: FilterSelectionFilters,
): SQL[] => {
  const conditions: SQL[] = [eq(enriched.planId, planId)];

  if (filters.accountId != null) {
    conditions.push(eq(enriched.accountId, filters.accountId));
  }

  if (filters.payeeId != null) {
    conditions.push(eq(enriched.payeeId, filters.payeeId));
  }

  if (filters.amountMinMilliunits != null) {
    conditions.push(
      sql`${enriched.amountUnits} >= ${filters.amountMinMilliunits} / 1000.0`,
    );
  }

  if (filters.amountMaxMilliunits != null) {
    conditions.push(
      sql`${enriched.amountUnits} <= ${filters.amountMaxMilliunits} / 1000.0`,
    );
  }

  return conditions;
};

/** Unapproved, plain (non-transfer, non-split) transactions: the only ones the job touches. */
const actionableCondition = sql`not ${enriched.approved} and not ${enriched.isTransfer} and not ${enriched.isSplit}`;

export type FilterMatchRow = {
  id: string;
  date: string;
  amountUnits: string;
  memo: string | null;
  approved: boolean;
  accountName: string | null;
  payeeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroupName: string | null;
  isTransfer: boolean;
  isSplit: boolean;
};

export type FilterPreview = {
  matched: number;
  /** Unapproved plain transactions the job would act on right now. */
  actionable: number;
  rows: FilterMatchRow[];
  truncated: boolean;
};

export const PREVIEW_ROW_LIMIT = 200;

export const previewFilterSelection = async (
  db: Database,
  planId: string,
  filters: FilterSelectionFilters,
): Promise<FilterPreview> => {
  const where = and(...filterConditions(planId, filters));

  const [counts] = await db
    .select({
      matched: sql<number>`count(*)::int`,
      actionable: sql<number>`(count(*) filter (where ${actionableCondition}))::int`,
    })
    .from(enriched)
    .where(where);

  const rows = await db
    .select({
      id: enriched.id,
      date: enriched.date,
      amountUnits: enriched.amountUnits,
      memo: enriched.memo,
      approved: enriched.approved,
      accountName: enriched.accountName,
      payeeName: enriched.payeeName,
      categoryId: enriched.categoryId,
      categoryName: enriched.categoryName,
      categoryGroupName: enriched.categoryGroupName,
      isTransfer: enriched.isTransfer,
      isSplit: enriched.isSplit,
    })
    .from(enriched)
    .where(where)
    .orderBy(desc(enriched.date), asc(enriched.id))
    .limit(PREVIEW_ROW_LIMIT);

  return {
    matched: counts.matched,
    actionable: counts.actionable,
    rows,
    truncated: counts.matched > rows.length,
  };
};

export type ApplicableTransaction = {
  id: string;
  date: string;
  amountMilliunits: number;
  accountName: string | null;
  payeeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  approved: boolean;
};

/** Transactions the rule would act on now: matching, unapproved, plain. */
export const findApplicableTransactions = async (
  db: Database,
  planId: string,
  filters: FilterSelectionFilters,
): Promise<ApplicableTransaction[]> => {
  const rows = await db
    .select({
      id: enriched.id,
      date: enriched.date,
      amountUnits: enriched.amountUnits,
      accountName: enriched.accountName,
      payeeName: enriched.payeeName,
      categoryId: enriched.categoryId,
      categoryName: enriched.categoryName,
      approved: enriched.approved,
    })
    .from(enriched)
    .where(and(...filterConditions(planId, filters), actionableCondition))
    .orderBy(asc(enriched.date), asc(enriched.id));

  return rows.map(({ amountUnits, ...row }) => ({
    ...row,
    amountMilliunits: Math.round(Number(amountUnits) * 1000),
  }));
};

export const recordFilterAuditEntries = async (
  db: Database,
  entries: NewBudgetFilterSelectionAudit[],
): Promise<void> => {
  if (entries.length === 0) {
    return;
  }

  await db.insert(budgetFilterSelectionAudit).values(entries);
};

/** Keys (`transactionId|action|toValue`) already applied, to stay idempotent while typed tables are stale. */
export const listAppliedAuditKeys = async (
  db: Database,
  planId: string,
  transactionIds: string[],
): Promise<Set<string>> => {
  if (transactionIds.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({
      transactionId: budgetFilterSelectionAudit.transactionId,
      action: budgetFilterSelectionAudit.action,
      toValue: budgetFilterSelectionAudit.toValue,
    })
    .from(budgetFilterSelectionAudit)
    .where(
      and(
        eq(budgetFilterSelectionAudit.planId, planId),
        eq(budgetFilterSelectionAudit.status, 'applied'),
        inArray(budgetFilterSelectionAudit.transactionId, transactionIds),
      ),
    );

  return new Set(
    rows.map((r) => `${r.transactionId}|${r.action}|${r.toValue ?? ''}`),
  );
};

export type ListFilterAuditOptions = {
  filterSelectionId?: string;
  status?: FilterAuditStatus;
  limit?: number;
  offset?: number;
};

export const listFilterAuditEntries = async (
  db: Database,
  options: ListFilterAuditOptions = {},
): Promise<BudgetFilterSelectionAudit[]> =>
  db
    .select()
    .from(budgetFilterSelectionAudit)
    .where(
      and(
        options.filterSelectionId
          ? eq(
              budgetFilterSelectionAudit.filterSelectionId,
              options.filterSelectionId,
            )
          : undefined,
        options.status
          ? eq(budgetFilterSelectionAudit.status, options.status)
          : undefined,
      ),
    )
    .orderBy(desc(budgetFilterSelectionAudit.appliedAt))
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0);

export type YnabReference = {
  accounts: { id: string; name: string; closed: boolean }[];
  payees: { id: string; name: string }[];
  categories: {
    id: string;
    name: string;
    groupName: string;
    hidden: boolean;
  }[];
};

/** Names for pickers and for freezing readable audit text. Live rows only. */
export const getYnabReference = async (
  db: Database,
  planId: string,
): Promise<YnabReference> => {
  const accounts = await db
    .select({
      id: ynabAccounts.id,
      name: ynabAccounts.name,
      closed: ynabAccounts.closed,
    })
    .from(ynabAccounts)
    .where(
      and(eq(ynabAccounts.planId, planId), eq(ynabAccounts.deleted, false)),
    )
    .orderBy(asc(ynabAccounts.name));

  const payees = await db
    .select({ id: ynabPayees.id, name: ynabPayees.name })
    .from(ynabPayees)
    .where(and(eq(ynabPayees.planId, planId), eq(ynabPayees.deleted, false)))
    .orderBy(asc(ynabPayees.name));

  const categories = await db
    .select({
      id: ynabCategories.id,
      name: ynabCategories.name,
      groupName: ynabCategoryGroups.name,
      hidden: ynabCategories.hidden,
    })
    .from(ynabCategories)
    .innerJoin(
      ynabCategoryGroups,
      and(
        eq(ynabCategoryGroups.planId, ynabCategories.planId),
        eq(ynabCategoryGroups.id, ynabCategories.categoryGroupId),
      ),
    )
    .where(
      and(eq(ynabCategories.planId, planId), eq(ynabCategories.deleted, false)),
    )
    .orderBy(asc(ynabCategoryGroups.name), asc(ynabCategories.name));

  return { accounts, payees, categories };
};
