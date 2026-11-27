import { and, eq, gte, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  scoreCandidates,
  type Candidate,
  type CandidateSourceRow,
} from '../candidate-scoring';
import { ynabTransactionsEnriched as enriched } from '../schema/views/ynab-transactions-enriched';
import { listFilterSelections } from './filter-selections';

export const CANDIDATE_HISTORY_MONTHS = 12;

export type ListCandidatesOptions = {
  planId: string;
  /** Only list payees with at least one un-approved transaction. */
  unapprovedOnly?: boolean;
  /** Include payees an enabled rule already matches. */
  includeCovered?: boolean;
  /** `YYYY-MM-DD`; defaults to 12 months back. */
  sinceDate?: string;
};

const defaultSince = (): string => {
  const d = new Date();

  d.setUTCMonth(d.getUTCMonth() - CANDIDATE_HISTORY_MONTHS);

  return d.toISOString().slice(0, 10);
};

/**
 * Scores every recurring payee (transfers and splits excluded, like rules).
 * Scoring uses the full history; `unapprovedOnly` only filters the result.
 */
export const listCandidates = async (
  db: Database,
  options: ListCandidatesOptions,
): Promise<Candidate[]> => {
  const rows = await db
    .select({
      payeeId: enriched.payeeId,
      payeeName: enriched.payeeName,
      date: enriched.date,
      amountUnits: enriched.amountUnits,
      approved: enriched.approved,
      categoryName: enriched.categoryName,
    })
    .from(enriched)
    .where(
      and(
        eq(enriched.planId, options.planId),
        eq(enriched.isTransfer, false),
        eq(enriched.isSplit, false),
        gte(enriched.date, options.sinceDate ?? defaultSince()),
        sql`${enriched.payeeName} is not null`,
      ),
    );

  const source: CandidateSourceRow[] = rows.map((r) => ({
    ...r,
    amountUnits: Number(r.amountUnits),
  }));

  const rules = (await listFilterSelections(db)).filter(
    (r) => r.planId === options.planId,
  );

  return scoreCandidates(source, rules).filter(
    (c) =>
      (!options.unapprovedOnly || c.unapprovedCount > 0) &&
      (options.includeCovered || !c.coveredByRule),
  );
};
