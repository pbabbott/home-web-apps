import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../client';
import {
  backupEntries,
  backupJobItems,
  backupJobs,
  type BackupJobItemStatus,
  type BackupJobStatus,
} from '../../schema/backup';
import {
  inventoryItems,
  type InventoryItemDecision,
  type InventoryItemKind,
} from '../../schema/discovery';
import { listApplicableRules, resolveExclusion } from '../exclusion-rules';
import { ACTIVE_BACKUP_JOB_STATUSES } from './shared';

export type BackupCoverageBucket =
  | 'covered'
  | 'redundant_covered'
  | 'excluded_rule'
  | 'rejected'
  | 'undecided'
  | 'pending'
  | 'failed'
  | 'blocked'
  | 'never_attempted';

export const BACKUP_COVERAGE_BUCKETS: BackupCoverageBucket[] = [
  'covered',
  'redundant_covered',
  'excluded_rule',
  'rejected',
  'undecided',
  'pending',
  'failed',
  'blocked',
  'never_attempted',
];

/**
 * Buckets that stop `allAccounted`. `rejected` and `excluded_rule` are
 * intentional and do not. `never_attempted` also holds approved items whose
 * jobs ended without trying them (a cancelled job leaves them `queued`).
 */
export const BLOCKING_BACKUP_COVERAGE_BUCKETS: BackupCoverageBucket[] = [
  'undecided',
  'pending',
  'failed',
  'blocked',
  'never_attempted',
];

/** What is known about one inventory item at one destination. */
export type BackupCoverageFacts = {
  decision: InventoryItemDecision;
  /** Approved but under an `exclude_subtree` rule. */
  excludedByRule: boolean;
  /** Some job item for it at the destination is `verified`. */
  verified: boolean;
  /** A nested item whose covering item verified it. */
  redundantCovered: boolean;
  /** Queued or in progress in an active job (its own, or its covering item's). */
  activeWork: boolean;
  /** The most recent attempt's outcome, when it failed or blocked. */
  latestOutcome: 'failed' | 'blocked' | null;
};

/**
 * Puts an inventory item in exactly one bucket. The human's current decision
 * comes first; verified data is never deleted, so `covered` then outranks
 * anything a later job did, a later failure included.
 */
export const classifyBackupCoverage = (
  facts: BackupCoverageFacts,
): BackupCoverageBucket => {
  if (facts.decision === 'rejected') return 'rejected';
  if (facts.decision === 'pending') return 'undecided';
  if (facts.verified) return 'covered';
  if (facts.redundantCovered) return 'redundant_covered';
  if (facts.excludedByRule) return 'excluded_rule';
  if (facts.activeWork) return 'pending';
  if (facts.latestOutcome) return facts.latestOutcome;

  return 'never_attempted';
};

export type BackupCoverageAttempt = {
  jobId: string;
  jobStatus: BackupJobStatus;
  jobItemId: string;
  itemStatus: BackupJobItemStatus;
  statusReason: string | null;
  lastError: string | null;
  attemptCount: number;
  updatedAt: Date;
};

export type BackupCoverageItem = {
  inventoryItemId: string;
  kind: InventoryItemKind;
  rootPath: string;
  normalizedRootPath: string;
  decision: InventoryItemDecision;
  bucket: BackupCoverageBucket;
  /** The latest job item for it at this destination, whatever its outcome. */
  latestAttempt: BackupCoverageAttempt | null;
};

export type BackupCoverageReport = {
  sourceId: string;
  destinationId: string;
  generatedAt: Date;
  /** True only when no inventory item is in a blocking bucket. */
  allAccounted: boolean;
  total: number;
  counts: Record<BackupCoverageBucket, number>;
  /** Display-only notes that do not change `allAccounted`. */
  notes: {
    /** Verified files written under a keep-both name. */
    keptBothFiles: number;
    /** Junctions and other special objects recorded but not followed. */
    notFollowedEntries: number;
  };
  /** Every item, or only those in `bucket` when one was asked for. */
  items: BackupCoverageItem[];
};

const CHUNK = 500;

/**
 * Coverage of one source at one destination, derived from the job items and
 * entries (there is no coverage table). An inventory item is covered when
 * some job item for it, in a job to this destination, is `verified`, or when
 * it is nested inside a covering item that verified an entry at its path
 * (entry paths are relative to the covering root, backslash-separated and
 * lowercased like the other normalized paths). Because verified data is never
 * deleted, a later failed job does not revoke coverage; the latest attempt is
 * reported beside it.
 */
export const getBackupCoverage = async (
  db: Database,
  input: {
    sourceId: string;
    destinationId: string;
    bucket?: BackupCoverageBucket;
  },
): Promise<BackupCoverageReport> => {
  const inv = inventoryItems;
  const ji = backupJobItems;
  const j = backupJobs;

  const inventory = await db
    .select({
      id: inv.id,
      kind: inv.kind,
      rootPath: inv.rootPath,
      normalizedRootPath: inv.normalizedRootPath,
      decision: inv.decision,
    })
    .from(inv)
    .where(eq(inv.sourceId, input.sourceId))
    .orderBy(inv.normalizedRootPath);

  const rules = await listApplicableRules(db, [input.sourceId]);

  const jobItems = await db
    .select({
      id: ji.id,
      jobId: ji.jobId,
      inventoryItemId: ji.inventoryItemId,
      normalizedRootPath: ji.normalizedRootPath,
      coveredByJobItemId: ji.coveredByJobItemId,
      status: ji.status,
      statusReason: ji.statusReason,
      lastError: ji.lastError,
      attemptCount: ji.attemptCount,
      updatedAt: ji.updatedAt,
      jobStatus: j.status,
      jobCreatedAt: j.createdAt,
    })
    .from(ji)
    .innerJoin(j, eq(j.id, ji.jobId))
    .where(
      and(
        eq(j.sourceId, input.sourceId),
        eq(j.destinationId, input.destinationId),
      ),
    );

  const byId = new Map(jobItems.map((row) => [row.id, row]));
  const relPathUnder = (root: string, path: string) =>
    path.slice(root.length).replace(/^\\+/, '');

  // Verified entries at the paths of nested items, fetched as exact pairs.
  const wanted = new Map<string, { jobItemId: string; rel: string }>();
  for (const row of jobItems) {
    const covering = row.coveredByJobItemId
      ? byId.get(row.coveredByJobItemId)
      : undefined;
    if (covering?.status === 'verified') {
      const rel = relPathUnder(
        covering.normalizedRootPath,
        row.normalizedRootPath,
      );
      wanted.set(`${covering.id}|${rel}`, { jobItemId: covering.id, rel });
    }
  }
  const verifiedEntries = new Set<string>();
  const pairs = [...wanted.values()];
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    const e = backupEntries;
    const rows = await db
      .select({ jobItemId: e.jobItemId, rel: e.normalizedRelPath })
      .from(e)
      .where(
        and(
          eq(e.status, 'verified'),
          sql`(${e.jobItemId}, ${e.normalizedRelPath}) in (${sql.join(
            chunk.map((p) => sql`(${p.jobItemId}::uuid, ${p.rel})`),
            sql`, `,
          )})`,
        ),
      );
    for (const row of rows) verifiedEntries.add(`${row.jobItemId}|${row.rel}`);
  }

  const isActive = (status: BackupJobStatus) =>
    ACTIVE_BACKUP_JOB_STATUSES.includes(status);
  const isWaiting = (status: BackupJobItemStatus) =>
    status === 'queued' || status === 'in_progress';

  const itemsByInventory = new Map<string, typeof jobItems>();
  for (const row of jobItems) {
    if (!row.inventoryItemId) continue;
    const list = itemsByInventory.get(row.inventoryItemId) ?? [];
    list.push(row);
    itemsByInventory.set(row.inventoryItemId, list);
  }

  const counts = Object.fromEntries(
    BACKUP_COVERAGE_BUCKETS.map((b) => [b, 0]),
  ) as Record<BackupCoverageBucket, number>;
  const items: BackupCoverageItem[] = [];

  for (const item of inventory) {
    const rows = itemsByInventory.get(item.id) ?? [];

    // A nested item mirrors the fate of the item that covers it.
    const effective = (row: (typeof rows)[number]) => {
      const covering = row.coveredByJobItemId
        ? byId.get(row.coveredByJobItemId)
        : undefined;

      return covering ?? row;
    };

    const verified = rows.some((row) => row.status === 'verified');
    const redundantCovered = rows.some((row) => {
      const covering = row.coveredByJobItemId
        ? byId.get(row.coveredByJobItemId)
        : undefined;

      return (
        covering?.status === 'verified' &&
        verifiedEntries.has(
          `${covering.id}|${relPathUnder(covering.normalizedRootPath, row.normalizedRootPath)}`,
        )
      );
    });
    const activeWork = rows.some((row) => {
      const e = effective(row);

      return isActive(e.jobStatus) && isWaiting(e.status);
    });

    const latest = [...rows].sort(
      (a, b) =>
        b.jobCreatedAt.getTime() - a.jobCreatedAt.getTime() ||
        (a.id < b.id ? 1 : -1),
    )[0];
    const latestStatus = latest ? effective(latest).status : undefined;

    const bucket = classifyBackupCoverage({
      decision: item.decision,
      excludedByRule:
        item.decision === 'approved' &&
        resolveExclusion(rules, item.normalizedRootPath).state === 'excluded',
      verified,
      redundantCovered,
      activeWork,
      latestOutcome:
        latestStatus === 'failed' || latestStatus === 'blocked'
          ? latestStatus
          : null,
    });
    counts[bucket] += 1;

    if (input.bucket && input.bucket !== bucket) continue;

    items.push({
      inventoryItemId: item.id,
      kind: item.kind,
      rootPath: item.rootPath,
      normalizedRootPath: item.normalizedRootPath,
      decision: item.decision,
      bucket,
      latestAttempt: latest
        ? {
            jobId: latest.jobId,
            jobStatus: latest.jobStatus,
            jobItemId: latest.id,
            itemStatus: latest.status,
            statusReason: latest.statusReason,
            lastError: latest.lastError,
            attemptCount: latest.attemptCount,
            updatedAt: latest.updatedAt,
          }
        : null,
    });
  }

  const e = backupEntries;
  const [notes] = await db
    .select({
      keptBothFiles: sql<number>`(count(*) filter (where ${e.issueKind} = 'kept_both' and ${e.status} = 'verified'))::int`,
      notFollowedEntries: sql<number>`(count(*) filter (where ${e.status} = 'not_followed'))::int`,
    })
    .from(e)
    .innerJoin(ji, eq(ji.id, e.jobItemId))
    .innerJoin(j, eq(j.id, ji.jobId))
    .where(
      and(
        eq(j.sourceId, input.sourceId),
        eq(j.destinationId, input.destinationId),
      ),
    );

  return {
    sourceId: input.sourceId,
    destinationId: input.destinationId,
    generatedAt: new Date(),
    allAccounted: BLOCKING_BACKUP_COVERAGE_BUCKETS.every(
      (b) => counts[b] === 0,
    ),
    total: inventory.length,
    counts,
    notes,
    items,
  };
};
