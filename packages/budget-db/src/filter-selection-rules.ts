import type {
  BudgetFilterSelection,
  FilterAuditAction,
} from './schema/budget-filter-selections';

/** Fields that select transactions. All optional, at least one required. */
export type FilterSelectionFilters = Pick<
  BudgetFilterSelection,
  'accountId' | 'payeeId' | 'amountMinMilliunits' | 'amountMaxMilliunits'
>;

/** What a rule does to a matched, unapproved transaction. */
export type FilterSelectionActions = Pick<
  BudgetFilterSelection,
  'categoryId' | 'autoApprove'
>;

export type FilterSelectionRule = Pick<
  BudgetFilterSelection,
  'id' | 'name' | 'planId'
> &
  FilterSelectionFilters &
  FilterSelectionActions;

/** Display names resolved at apply time, used to freeze readable text. */
export type RuleNames = {
  accountName?: string | null;
  payeeName?: string | null;
  categoryName?: string | null;
};

export const hasFilter = (filters: FilterSelectionFilters): boolean =>
  filters.accountId != null ||
  filters.payeeId != null ||
  filters.amountMinMilliunits != null ||
  filters.amountMaxMilliunits != null;

export const hasAction = (actions: FilterSelectionActions): boolean =>
  actions.categoryId != null || actions.autoApprove;

/** `-2500000` -> `-2,500.00`. */
export const formatMilliunits = (milliunits: number): string =>
  (milliunits / 1000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Human-readable text of a rule, frozen into each audit entry so history
 * survives later edits. Example:
 * `Mortgage: account "Checking" AND payee "Mortgage Co" AND amount -2,500.00
 * to -2,000.00 -> categorize "Rent/Mortgage", approve`
 */
export const describeRule = (
  rule: FilterSelectionRule,
  names: RuleNames = {},
): string => {
  const parts: string[] = [];

  if (rule.accountId != null) {
    parts.push(`account "${names.accountName ?? rule.accountId}"`);
  }

  if (rule.payeeId != null) {
    parts.push(`payee "${names.payeeName ?? rule.payeeId}"`);
  }

  const { amountMinMilliunits: min, amountMaxMilliunits: max } = rule;

  if (min != null && max != null) {
    parts.push(`amount ${formatMilliunits(min)} to ${formatMilliunits(max)}`);
  } else if (min != null) {
    parts.push(`amount >= ${formatMilliunits(min)}`);
  } else if (max != null) {
    parts.push(`amount <= ${formatMilliunits(max)}`);
  }

  const actions: string[] = [];

  if (rule.categoryId != null) {
    actions.push(`categorize "${names.categoryName ?? rule.categoryId}"`);
  }

  if (rule.autoApprove) {
    actions.push('approve');
  }

  return `${rule.name}: ${parts.join(' AND ')} -> ${actions.join(', ')}`;
};

export type PlannedChange = {
  transactionId: string;
  categoryId: string | null;
  approve: boolean;
  /** Rules that contributed, for the audit entry of each action. */
  categorizedBy: FilterSelectionRule | null;
  approvedBy: FilterSelectionRule | null;
};

export type SkippedConflict = {
  transactionId: string;
  rules: FilterSelectionRule[];
};

/**
 * Combines every rule that matched each transaction. Approve flags merge;
 * two rules wanting different categories is a conflict and the transaction
 * is skipped entirely (logged, not applied).
 */
export const resolveMatches = (
  matches: { transactionId: string; rule: FilterSelectionRule }[],
): { changes: PlannedChange[]; conflicts: SkippedConflict[] } => {
  const byTransaction = new Map<string, FilterSelectionRule[]>();

  for (const { transactionId, rule } of matches) {
    const rules = byTransaction.get(transactionId) ?? [];

    if (!rules.some((r) => r.id === rule.id)) {
      rules.push(rule);
    }
    byTransaction.set(transactionId, rules);
  }

  const changes: PlannedChange[] = [];
  const conflicts: SkippedConflict[] = [];

  for (const [transactionId, rules] of byTransaction) {
    const categorizers = rules.filter((r) => r.categoryId != null);
    const categories = new Set(categorizers.map((r) => r.categoryId));

    if (categories.size > 1) {
      conflicts.push({ transactionId, rules: categorizers });
      continue;
    }

    const approver = rules.find((r) => r.autoApprove) ?? null;

    changes.push({
      transactionId,
      categoryId: categorizers[0]?.categoryId ?? null,
      approve: approver !== null,
      categorizedBy: categorizers[0] ?? null,
      approvedBy: approver,
    });
  }

  return { changes, conflicts };
};

export const auditKey = (
  transactionId: string,
  action: FilterAuditAction,
  toValue: string | null,
): string => `${transactionId}|${action}|${toValue ?? ''}`;
