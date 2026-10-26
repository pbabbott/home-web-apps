import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { isForeignKeyViolation, isUniqueViolation } from '../pg-errors';
import {
  discoveryQueueItems,
  exclusionRules,
  type ExclusionRule,
  type ExclusionRuleScope,
} from '../schema/discovery';
import { insertAuditEvent, type Actor } from './audit';
import {
  DiscoveryError,
  MAX_AUDITED_ITEM_IDS,
  coversSql,
  type Tx,
} from './shared';

/**
 * How the rules treat one path.
 *
 * Precedence (never query order):
 * 1. An `exclude_subtree` rule on the path or any ancestor — global or
 *    source-specific — means `excluded`. No rule grants permission, so a
 *    source rule can never re-enable what a global rule excludes.
 * 2. Otherwise a `selective_only` rule on exactly the path means `selective`:
 *    the path is not a backup inventory item itself, but its descendants are still
 *    explored and judged on their own. A `selective_only` rule on an ancestor
 *    has no effect on descendants.
 * 3. Otherwise `none`.
 */
export type ExclusionState = 'none' | 'selective' | 'excluded';

export type ExclusionResolution = {
  state: ExclusionState;
  /** The rules that decided the state. */
  ruleIds: string[];
};

type RuleForResolution = Pick<ExclusionRule, 'id' | 'scope' | 'normalizedPath'>;

/** `path` is the rule's path or lies beneath it, on a directory boundary. */
const covers = (rulePath: string, path: string): boolean =>
  path === rulePath ||
  path.startsWith(rulePath.endsWith('\\') ? rulePath : `${rulePath}\\`);

/**
 * Pure resolution of a normalized path against rules that already apply to
 * its source (that source's rules plus global ones).
 */
export const resolveExclusion = (
  rules: RuleForResolution[],
  normalizedPath: string,
): ExclusionResolution => {
  const excluding = rules.filter(
    (r) =>
      r.scope === 'exclude_subtree' && covers(r.normalizedPath, normalizedPath),
  );
  if (excluding.length > 0) {
    return { state: 'excluded', ruleIds: excluding.map((r) => r.id) };
  }

  const selective = rules.filter(
    (r) => r.scope === 'selective_only' && r.normalizedPath === normalizedPath,
  );
  if (selective.length > 0) {
    return { state: 'selective', ruleIds: selective.map((r) => r.id) };
  }

  return { state: 'none', ruleIds: [] };
};

/**
 * Rules that apply to the given sources: each source's own rules plus all
 * global ones. Rules are few and human-curated, so callers resolve paths
 * against this list in memory (see resolveExclusion).
 */
export const listApplicableRules = async (
  db: Database | Tx,
  sourceIds: string[],
): Promise<ExclusionRule[]> => {
  const t = exclusionRules;
  const owned = [...new Set(sourceIds)];

  return db
    .select()
    .from(t)
    .where(or(isNull(t.sourceId), ...owned.map((id) => eq(t.sourceId, id))))
    .orderBy(asc(t.normalizedPath), asc(t.id));
};

/** Rules that apply to one source, for resolving paths of that source. */
export const rulesBySource = (
  rules: ExclusionRule[],
  sourceId: string,
): ExclusionRule[] =>
  rules.filter((r) => r.sourceId === null || r.sourceId === sourceId);

export type ListExclusionRulesOptions = {
  /** That source's rules plus global ones. Omit for every rule. */
  sourceId?: string;
  scope?: ExclusionRuleScope;
};

export const listExclusionRules = async (
  db: Database,
  options: ListExclusionRulesOptions = {},
): Promise<ExclusionRule[]> => {
  const t = exclusionRules;

  return db
    .select()
    .from(t)
    .where(
      and(
        options.sourceId
          ? or(isNull(t.sourceId), eq(t.sourceId, options.sourceId))
          : undefined,
        options.scope ? eq(t.scope, options.scope) : undefined,
      ),
    )
    .orderBy(asc(t.normalizedPath), asc(t.id));
};

const snapshot = (rule: ExclusionRule) => ({
  path: rule.path,
  scope: rule.scope,
  reason: rule.reason,
  global: rule.sourceId === null,
});

export type CreateExclusionRuleInput = {
  /** Null for a global rule. */
  sourceId: string | null;
  path: string;
  normalizedPath: string;
  scope: ExclusionRuleScope;
  reason?: string | null;
  actor: Actor;
};

/**
 * Creates a rule and its audit event in one transaction. At most one rule
 * exists per path per owner, and a path is never ruled both globally and by a
 * source: two rules for the same path could disagree, and the precedence
 * above would then hide one of them. Existing inventory items are left untouched.
 */
export const createExclusionRule = async (
  db: Database,
  input: CreateExclusionRuleInput,
): Promise<ExclusionRule> =>
  db.transaction(async (tx) => {
    // Serialize concurrent creates for one path so the conflict check below
    // cannot be raced (the unique index only covers a single owner).
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.normalizedPath}))`,
    );

    const t = exclusionRules;
    const [clash] = await tx
      .select({ id: t.id, sourceId: t.sourceId })
      .from(t)
      .where(
        and(
          eq(t.normalizedPath, input.normalizedPath),
          input.sourceId === null
            ? undefined
            : or(isNull(t.sourceId), eq(t.sourceId, input.sourceId)),
        ),
      )
      .limit(1);

    if (clash) {
      throw new DiscoveryError(
        'conflict',
        clash.sourceId === null || input.sourceId === null
          ? 'a rule for this path already exists at another level (global or source)'
          : 'a rule for this path already exists for this source',
        { existingRuleId: clash.id },
      );
    }

    let rule: ExclusionRule;
    try {
      [rule] = await tx
        .insert(t)
        .values({
          sourceId: input.sourceId,
          path: input.path,
          normalizedPath: input.normalizedPath,
          scope: input.scope,
          reason: input.reason ?? null,
        })
        .returning();
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new DiscoveryError('not_found', 'source not found');
      }
      if (isUniqueViolation(err)) {
        throw new DiscoveryError(
          'conflict',
          'a rule for this path already exists',
        );
      }
      throw err;
    }

    await insertAuditEvent(tx, {
      eventType: 'exclusion_rule.created',
      actor: input.actor,
      sourceId: rule.sourceId,
      exclusionRuleId: rule.id,
      details: snapshot(rule),
    });

    return rule;
  });

export type UpdateExclusionRuleInput = {
  scope?: ExclusionRuleScope;
  /** Null clears the reason; undefined leaves it alone. */
  reason?: string | null;
  actor: Actor;
};

/** The path is immutable: a different path is a different rule. */
export const updateExclusionRule = async (
  db: Database,
  id: string,
  input: UpdateExclusionRuleInput,
): Promise<ExclusionRule> =>
  db.transaction(async (tx) => {
    const t = exclusionRules;
    const [before] = await tx
      .select()
      .from(t)
      .where(eq(t.id, id))
      .for('update');

    if (!before)
      throw new DiscoveryError('not_found', 'exclusion rule not found');

    const scope = input.scope ?? before.scope;
    const reason = input.reason === undefined ? before.reason : input.reason;
    if (scope === before.scope && reason === before.reason) return before;

    const [after] = await tx
      .update(t)
      .set({ scope, reason, updatedAt: sql`now()` })
      .where(eq(t.id, id))
      .returning();

    await insertAuditEvent(tx, {
      eventType: 'exclusion_rule.updated',
      actor: input.actor,
      sourceId: after.sourceId,
      exclusionRuleId: after.id,
      details: {
        path: after.path,
        before: { scope: before.scope, reason: before.reason },
        after: { scope: after.scope, reason: after.reason },
      },
    });

    return after;
  });

/**
 * Removes a rule. The event keeps a snapshot of it, since the rule itself is
 * gone. Existing inventory items and queue state are left as they are.
 */
export const deleteExclusionRule = async (
  db: Database,
  id: string,
  actor: Actor,
): Promise<void> =>
  db.transaction(async (tx) => {
    const [rule] = await tx
      .delete(exclusionRules)
      .where(eq(exclusionRules.id, id))
      .returning();

    if (!rule)
      throw new DiscoveryError('not_found', 'exclusion rule not found');

    await insertAuditEvent(tx, {
      eventType: 'exclusion_rule.deleted',
      actor,
      sourceId: rule.sourceId,
      exclusionRuleId: rule.id,
      details: snapshot(rule),
    });
  });

/**
 * Skips every still-queued item of the job that sits under an
 * `exclude_subtree` rule (global or the job's source), so it can never be
 * claimed. Called by claimNextQueueItem inside its transaction: that is the
 * single place work is handed out, so it catches items queued before the rule
 * existed as well as children enqueued later. In-progress items are left to
 * finish. Records one system audit event when anything was skipped.
 */
export const skipExcludedQueueItems = async (
  tx: Tx,
  input: { jobId: string; sourceId: string },
): Promise<number> => {
  const q = discoveryQueueItems;
  const r = exclusionRules;

  const skipped = await tx
    .update(q)
    .set({
      status: 'skipped',
      lastError: 'skipped: excluded by rule',
      completedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(q.jobId, input.jobId),
        eq(q.status, 'queued'),
        sql`exists (select 1 from ${r} where ${r.scope} = 'exclude_subtree' and (${r.sourceId} is null or ${r.sourceId} = ${input.sourceId}) and ${coversSql(r.normalizedPath, q.normalizedPath)})`,
      ),
    )
    .returning({ id: q.id, normalizedPath: q.normalizedPath });

  if (skipped.length === 0) return 0;

  const paths = JSON.stringify(skipped.map((s) => s.normalizedPath));
  const ruleRows = await tx
    .select({ id: r.id })
    .from(r)
    .where(
      and(
        eq(r.scope, 'exclude_subtree'),
        or(isNull(r.sourceId), eq(r.sourceId, input.sourceId)),
        sql`exists (select 1 from jsonb_array_elements_text(${paths}::jsonb) as p(path) where ${coversSql(r.normalizedPath, sql`p.path`)})`,
      ),
    );

  await insertAuditEvent(tx, {
    eventType: 'queue_items.excluded',
    actor: { type: 'system' },
    sourceId: input.sourceId,
    jobId: input.jobId,
    details: {
      count: skipped.length,
      ruleIds: ruleRows.map((row) => row.id),
      itemIds: skipped.slice(0, MAX_AUDITED_ITEM_IDS).map((s) => s.id),
      truncated: skipped.length > MAX_AUDITED_ITEM_IDS,
    },
  });

  return skipped.length;
};
