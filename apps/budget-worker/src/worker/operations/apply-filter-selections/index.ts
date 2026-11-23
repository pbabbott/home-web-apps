import {
  auditKey,
  createBudgetJob,
  describeRule,
  findApplicableTransactions,
  getYnabReference,
  listAppliedAuditKeys,
  listFilterSelections,
  recordFilterAuditEntries,
  resolveMatches,
  type ApplicableTransaction,
  type BudgetJob,
  type FilterSelectionRule,
  type NewBudgetFilterSelectionAudit,
  type PlannedChange,
} from '@abbottland/budget-db';
import { YnabApiError, ynabPatch } from '../../../api/ynab/ynab-client';
import { config, YNAB_PLAN_UNSET, YNAB_TOKEN_UNSET } from '../../../config';
import { db } from '../../../db';
import { JobProcessingError } from '../../job-processing-error';
import type { OperationResult } from '../operation-result';
import { isApplyFilterSelectionsParameters } from './parameters';

/** Transactions per PATCH request (1 YNAB request each). */
export const PATCH_BATCH_SIZE = 100;

type PatchItem = {
  change: PlannedChange;
  txn: ApplicableTransaction;
  /** Only the actions still to perform (not already applied). */
  categorize: boolean;
  approve: boolean;
};

/**
 * Applies every enabled FilterSelection to the unapproved transactions it
 * matches: categorizes and/or approves them in YNAB (PATCH) and appends one
 * audit entry per action with the rule text frozen as it was. Idempotent
 * while the typed tables are stale: actions already audited as `applied` are
 * not sent again. When it changed anything it queues a transactions-only sync
 * so the result flows back through raw -> typed.
 */
export const applyFilterSelections = async (
  job: BudgetJob,
): Promise<OperationResult> => {
  if (!isApplyFilterSelectionsParameters(job.parameters)) {
    throw new JobProcessingError('invalid apply_filter_selections parameters');
  }

  if (config.ynab.apiToken === YNAB_TOKEN_UNSET) {
    throw new JobProcessingError('YNAB_API_TOKEN is not configured');
  }

  if (config.ynab.planId === YNAB_PLAN_UNSET) {
    throw new JobProcessingError('YNAB_PLAN_ID is not configured');
  }

  const planId = config.ynab.planId;
  const rules = await listFilterSelections(db, { enabledOnly: true, planId });

  if (rules.length === 0) {
    return { message: 'No enabled filter selections.' };
  }

  const reference = await getYnabReference(db, planId);
  const accountNames = new Map(reference.accounts.map((a) => [a.id, a.name]));
  const payeeNames = new Map(reference.payees.map((p) => [p.id, p.name]));
  const categoryNames = new Map(
    reference.categories.map((c) => [c.id, c.name]),
  );

  const describe = (rule: FilterSelectionRule) =>
    describeRule(rule, {
      accountName: rule.accountId ? accountNames.get(rule.accountId) : null,
      payeeName: rule.payeeId ? payeeNames.get(rule.payeeId) : null,
      categoryName: rule.categoryId ? categoryNames.get(rule.categoryId) : null,
    });

  const originals = new Map<string, FilterSelectionRule>(
    rules.map((r) => [r.id, r]),
  );
  const txns = new Map<string, ApplicableTransaction>();
  // Rule that would have categorized a transaction YNAB already categorized.
  const alreadyCategorized = new Map<string, FilterSelectionRule>();
  const matches: { transactionId: string; rule: FilterSelectionRule }[] = [];

  for (const rule of rules) {
    for (const txn of await findApplicableTransactions(db, planId, rule)) {
      txns.set(txn.id, txn);
      // Categorize only uncategorized transactions; approve still applies.
      if (
        txn.categoryId !== null &&
        rule.categoryId !== null &&
        !alreadyCategorized.has(txn.id)
      ) {
        alreadyCategorized.set(txn.id, rule);
      }
      const effective =
        txn.categoryId !== null ? { ...rule, categoryId: null } : rule;

      if (effective.categoryId !== null || effective.autoApprove) {
        matches.push({ transactionId: txn.id, rule: effective });
      }
    }
  }

  const { changes, conflicts } = resolveMatches(matches);
  const applied = await listAppliedAuditKeys(db, planId, [...txns.keys()]);

  const entryBase = (
    rule: FilterSelectionRule,
    txn: ApplicableTransaction,
  ): Pick<
    NewBudgetFilterSelectionAudit,
    | 'jobId'
    | 'filterSelectionId'
    | 'ruleName'
    | 'ruleDescription'
    | 'ruleSnapshot'
    | 'planId'
    | 'transactionId'
    | 'transactionDate'
    | 'transactionAmount'
    | 'accountName'
    | 'payeeName'
  > => {
    const original = originals.get(rule.id) ?? rule;

    return {
      jobId: job.id,
      filterSelectionId: original.id,
      ruleName: original.name,
      ruleDescription: describe(original),
      ruleSnapshot: original,
      planId,
      transactionId: txn.id,
      transactionDate: txn.date,
      transactionAmount: txn.amountMilliunits,
      accountName: txn.accountName,
      payeeName: txn.payeeName,
    };
  };

  await recordFilterAuditEntries(
    db,
    conflicts.flatMap(({ transactionId, rules: conflicting }) => {
      const txn = txns.get(transactionId)!;

      return conflicting.map((rule) => ({
        ...entryBase(rule, txn),
        action: 'categorize' as const,
        fromValue: txn.categoryName,
        toValue: categoryNames.get(rule.categoryId!) ?? rule.categoryId,
        status: 'skipped_conflict' as const,
        error: `Matched rules with different categories: ${conflicting
          .map((r) => `"${r.name}"`)
          .join(', ')}`,
      }));
    }),
  );

  const items: PatchItem[] = [];

  for (const change of changes) {
    const txn = txns.get(change.transactionId)!;
    const categoryName = change.categoryId
      ? (categoryNames.get(change.categoryId) ?? change.categoryId)
      : null;
    const categorize =
      change.categoryId !== null &&
      !applied.has(auditKey(txn.id, 'categorize', categoryName));
    const approve =
      change.approve && !applied.has(auditKey(txn.id, 'approve', 'approved'));

    if (categorize || approve) {
      items.push({ change, txn, categorize, approve });
    }
  }

  let written = 0;
  let stopReason: string | undefined;

  for (let i = 0; i < items.length && !stopReason; i += PATCH_BATCH_SIZE) {
    const batch = items.slice(i, i + PATCH_BATCH_SIZE);
    const entries = batch.flatMap(({ change, txn, categorize, approve }) => {
      const out: (Omit<NewBudgetFilterSelectionAudit, 'status' | 'error'> & {
        status?: 'unchanged';
      })[] = [];
      const preset = alreadyCategorized.get(txn.id);

      // No change needed: record the category as it was when the rule ran.
      // Logged only alongside the approve, so it is written once per txn.
      if (!categorize && approve && preset && txn.categoryName) {
        out.push({
          ...entryBase(preset, txn),
          action: 'categorize',
          fromValue: txn.categoryName,
          toValue: txn.categoryName,
          status: 'unchanged',
        });
      }

      if (categorize) {
        out.push({
          ...entryBase(change.categorizedBy!, txn),
          action: 'categorize',
          fromValue: txn.categoryName ?? 'uncategorized',
          toValue: categoryNames.get(change.categoryId!) ?? change.categoryId,
        });
      }

      if (approve) {
        out.push({
          ...entryBase(change.approvedBy!, txn),
          action: 'approve',
          fromValue: 'unapproved',
          toValue: 'approved',
        });
      }

      return out;
    });

    try {
      await ynabPatch(`/plans/${planId}/transactions`, {
        transactions: batch.map(({ change, categorize, approve, txn }) => ({
          id: txn.id,
          ...(categorize ? { category_id: change.categoryId } : {}),
          ...(approve ? { approved: true } : {}),
        })),
      });
    } catch (err) {
      if (err instanceof YnabApiError && err.isRateLimited) {
        stopReason = 'YNAB returned 429 (rate limited)';
        continue;
      }

      const message = err instanceof Error ? err.message : String(err);

      await recordFilterAuditEntries(
        db,
        entries
          .filter((e) => e.status !== 'unchanged')
          .map((e) => ({
            ...e,
            status: 'failed' as const,
            error: message,
          })),
      );
      throw new JobProcessingError(
        `apply_filter_selections failed: ${message}`,
      );
    }

    await recordFilterAuditEntries(
      db,
      entries.map((e) => ({
        ...e,
        status: e.status ?? ('applied' as const),
        error: null,
      })),
    );
    written += entries.filter((e) => e.status !== 'unchanged').length;
  }

  // Let the change flow back raw -> typed; the follow-up apply then finds nothing.
  if (written > 0) {
    await createBudgetJob(db, {
      operation: 'ynab_sync',
      parameters: { endpoints: ['transactions'] },
    });
  }

  const message = `Applied ${written} actions across ${items.length} transactions (${conflicts.length} transactions skipped for conflicting rules).`;

  return {
    message: stopReason ? `${message} Stopped early: ${stopReason}.` : message,
  };
};
