import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  ne,
  sql,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../client';
import {
  ynabAccounts,
  ynabCategories,
  ynabCategoryGroups,
  ynabPayees,
  ynabPlans,
  type YnabAccountRow,
  type YnabCategoryGroupRow,
  type YnabCategoryRow,
  type YnabPayeeRow,
  type YnabPlanRow,
} from '../schema/ynab-entities';
import {
  ynabMonthCategories,
  ynabMonths,
  type YnabMonthCategoryRow,
  type YnabMonthRow,
} from '../schema/ynab-months';
import {
  ynabRawResponses,
  type YnabEndpoint,
} from '../schema/ynab-raw-responses';
import {
  ynabScheduledSubtransactions,
  ynabScheduledTransactions,
  ynabSubtransactions,
  ynabTransactions,
  type YnabScheduledSubtransactionRow,
  type YnabScheduledTransactionRow,
  type YnabSubtransactionRow,
  type YnabTransactionRow,
} from '../schema/ynab-transactions';
import {
  ynabTransformState,
  type YnabTransformState,
} from '../schema/ynab-transform-state';

export type YnabPlanEndpoint = Exclude<YnabEndpoint, 'plans'>;

/** Typed rows produced from one raw response, keyed by destination table. */
export type YnabTransformRows = {
  accounts?: YnabAccountRow[];
  categoryGroups?: YnabCategoryGroupRow[];
  categories?: YnabCategoryRow[];
  payees?: YnabPayeeRow[];
  transactions?: YnabTransactionRow[];
  subtransactions?: YnabSubtransactionRow[];
  scheduledTransactions?: YnabScheduledTransactionRow[];
  scheduledSubtransactions?: YnabScheduledSubtransactionRow[];
  months?: YnabMonthRow[];
  monthCategories?: YnabMonthCategoryRow[];
};

type TableKey = keyof YnabTransformRows;

type ParentTable = { table: PgTable; keys: string[] };
type ChildTable = {
  table: PgTable;
  /** Column on the child holding the parent's id. */
  parentColumn: string;
  parent: TableKey;
};

/** Tables whose rows are upserted by primary key. */
const PARENT_TABLES: Partial<Record<TableKey, ParentTable>> = {
  accounts: { table: ynabAccounts, keys: ['planId', 'id'] },
  categoryGroups: { table: ynabCategoryGroups, keys: ['planId', 'id'] },
  categories: { table: ynabCategories, keys: ['planId', 'id'] },
  payees: { table: ynabPayees, keys: ['planId', 'id'] },
  transactions: { table: ynabTransactions, keys: ['planId', 'id'] },
  scheduledTransactions: {
    table: ynabScheduledTransactions,
    keys: ['planId', 'id'],
  },
  months: { table: ynabMonths, keys: ['planId', 'month'] },
  monthCategories: {
    table: ynabMonthCategories,
    keys: ['planId', 'month', 'categoryId'],
  },
};

/** Tables replaced wholesale for every parent present in the response. */
const CHILD_TABLES: Partial<Record<TableKey, ChildTable>> = {
  subtransactions: {
    table: ynabSubtransactions,
    parentColumn: 'transactionId',
    parent: 'transactions',
  },
  scheduledSubtransactions: {
    table: ynabScheduledSubtransactions,
    parentColumn: 'scheduledTransactionId',
    parent: 'scheduledTransactions',
  },
};

/** Which typed tables each plan-scoped endpoint feeds (parents before children). */
export const YNAB_ENDPOINT_TABLES: Record<YnabPlanEndpoint, TableKey[]> = {
  accounts: ['accounts'],
  categories: ['categoryGroups', 'categories'],
  payees: ['payees'],
  transactions: ['transactions', 'subtransactions'],
  scheduled_transactions: ['scheduledTransactions', 'scheduledSubtransactions'],
  months: ['months', 'monthCategories'],
};

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// Postgres allows 65535 bind parameters per statement; rows have up to ~25 columns.
const INSERT_CHUNK = 500;

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

const upsertRows = async (
  tx: Tx,
  table: PgTable,
  keys: string[],
  rows: Record<string, unknown>[],
) => {
  if (rows.length === 0) return;

  const columns = getTableColumns(table);

  // A single INSERT cannot touch the same key twice; later rows win.
  const byKey = new Map(
    rows.map((row) => [keys.map((k) => String(row[k])).join('\u0000'), row]),
  );

  const set = Object.fromEntries(
    Object.entries(columns)
      .filter(([prop]) => !keys.includes(prop))
      .map(([prop, column]) => [
        prop,
        column.name === 'updated_at'
          ? sql`now()`
          : sql`excluded.${sql.identifier(column.name)}`,
      ]),
  );

  for (const batch of chunks([...byKey.values()], INSERT_CHUNK)) {
    await tx
      .insert(table)
      .values(batch)
      .onConflictDoUpdate({ target: keys.map((k) => columns[k]), set });
  }
};

export type ApplyYnabRawResponseInput = {
  rawResponseId: string;
  planId: string;
  endpoint: YnabPlanEndpoint;
  /** True when no cursor was sent: the response lists every live entity. */
  isSnapshot: boolean;
  rows: YnabTransformRows;
};

/**
 * Applies one raw response to the typed tables and advances the watermark,
 * in one transaction: a crash can neither skip nor double-apply a response.
 * Returns rows written per table.
 */
export const applyYnabRawResponse = async (
  db: Database,
  input: ApplyYnabRawResponseInput,
): Promise<Partial<Record<TableKey, number>>> => {
  const { rawResponseId, planId, endpoint, isSnapshot, rows } = input;
  const written: Partial<Record<TableKey, number>> = {};

  await db.transaction(async (tx) => {
    for (const key of YNAB_ENDPOINT_TABLES[endpoint]) {
      const tableRows = (rows[key] ?? []) as Record<string, unknown>[];
      written[key] = tableRows.length;

      const child = CHILD_TABLES[key];

      if (child) {
        const columns = getTableColumns(child.table);
        const parentIds = [
          ...new Set(
            ((rows[child.parent] ?? []) as { id: string }[]).map((p) => p.id),
          ),
        ];

        for (const batch of chunks(parentIds, INSERT_CHUNK)) {
          await tx
            .delete(child.table)
            .where(
              and(
                eq(columns.planId, planId),
                inArray(columns[child.parentColumn], batch),
              ),
            );
        }

        for (const batch of chunks(tableRows, INSERT_CHUNK)) {
          await tx.insert(child.table).values(batch);
        }

        continue;
      }

      const parent = PARENT_TABLES[key]!;

      await upsertRows(tx, parent.table, parent.keys, tableRows);

      if (isSnapshot) {
        // A snapshot lists every live entity; whatever this response did not
        // touch no longer exists.
        const columns = getTableColumns(parent.table);

        await tx
          .update(parent.table)
          .set({ deleted: true, updatedAt: sql`now()` })
          .where(
            and(
              eq(columns.planId, planId),
              eq(columns.deleted, false),
              ne(columns.lastRawResponseId, rawResponseId),
            ),
          );
      }
    }

    await tx
      .insert(ynabTransformState)
      .values({ planId, endpoint, lastRawResponseId: rawResponseId })
      .onConflictDoUpdate({
        target: [ynabTransformState.planId, ynabTransformState.endpoint],
        set: { lastRawResponseId: rawResponseId, updatedAt: sql`now()` },
      });
  });

  return written;
};

export const getYnabTransformState = async (
  db: Database,
  planId: string,
  endpoint: YnabPlanEndpoint,
): Promise<YnabTransformState | undefined> => {
  const [state] = await db
    .select()
    .from(ynabTransformState)
    .where(
      and(
        eq(ynabTransformState.planId, planId),
        eq(ynabTransformState.endpoint, endpoint),
      ),
    );

  return state;
};

/** Plans that have plan-scoped raw responses (the plans to transform). */
export const listYnabRawPlanIds = async (db: Database): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ planId: ynabRawResponses.planId })
    .from(ynabRawResponses)
    .orderBy(asc(ynabRawResponses.planId));

  return rows.flatMap((row) => (row.planId ? [row.planId] : []));
};

export type PendingYnabRawResponse = { id: string; isSnapshot: boolean };

/**
 * Raw responses not yet applied for (plan, endpoint), oldest first. Ids only,
 * so a large backlog of full snapshots is never held in memory at once.
 * "After the watermark" is decided in SQL on (fetched_at, id) because JS
 * dates would truncate Postgres' microsecond timestamps.
 */
export const listPendingYnabRawResponses = async (
  db: Database,
  planId: string,
  endpoint: YnabPlanEndpoint,
): Promise<PendingYnabRawResponse[]> => {
  const state = await getYnabTransformState(db, planId, endpoint);

  const rows = await db
    .select({
      id: ynabRawResponses.id,
      serverKnowledgeRequested: ynabRawResponses.serverKnowledgeRequested,
    })
    .from(ynabRawResponses)
    .where(
      and(
        eq(ynabRawResponses.planId, planId),
        eq(ynabRawResponses.endpoint, endpoint),
        state
          ? sql`(${ynabRawResponses.fetchedAt}, ${ynabRawResponses.id}) > (
              select w.fetched_at, w.id from ynab_raw_responses w
              where w.id = ${state.lastRawResponseId}
            )`
          : undefined,
      ),
    )
    .orderBy(asc(ynabRawResponses.fetchedAt), asc(ynabRawResponses.id));

  return rows.map((row) => ({
    id: row.id,
    isSnapshot: row.serverKnowledgeRequested === null,
  }));
};

export const getYnabRawPayload = async (
  db: Database,
  rawResponseId: string,
): Promise<unknown> => {
  const [row] = await db
    .select({ payload: ynabRawResponses.payload })
    .from(ynabRawResponses)
    .where(eq(ynabRawResponses.id, rawResponseId));

  return row?.payload;
};

/** The newest `plans` response; the endpoint has no deltas so only it matters. */
export const getLatestYnabPlansResponse = async (
  db: Database,
): Promise<{ id: string; payload: unknown } | undefined> => {
  const [row] = await db
    .select({ id: ynabRawResponses.id, payload: ynabRawResponses.payload })
    .from(ynabRawResponses)
    .where(eq(ynabRawResponses.endpoint, 'plans'))
    .orderBy(desc(ynabRawResponses.fetchedAt), desc(ynabRawResponses.id))
    .limit(1);

  return row;
};

export const upsertYnabPlans = async (
  db: Database,
  rows: YnabPlanRow[],
): Promise<void> => {
  await db.transaction((tx) =>
    upsertRows(tx, ynabPlans, ['id'], rows as Record<string, unknown>[]),
  );
};

/**
 * Forgets everything derived from (plan, endpoint) so the next transform
 * re-folds all of its raw responses. Used for `rebuild` after a mapping or
 * schema change; needs no YNAB calls because raw is the source of truth.
 */
export const resetYnabTransform = async (
  db: Database,
  planId: string,
  endpoint: YnabPlanEndpoint,
): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const key of YNAB_ENDPOINT_TABLES[endpoint]) {
      const table = (PARENT_TABLES[key] ?? CHILD_TABLES[key])!.table;

      await tx.delete(table).where(eq(getTableColumns(table).planId, planId));
    }

    await tx
      .delete(ynabTransformState)
      .where(
        and(
          eq(ynabTransformState.planId, planId),
          eq(ynabTransformState.endpoint, endpoint),
        ),
      );
  });
};
