import type {
  ClaimQueueItemResult,
  DiscoveryQueueItem,
  InventoryItem,
  KnownSkip,
  NestedInventoryItem,
  QueueCounts,
} from '@abbottland/homelab-db';
import type { ProposedInventoryItem } from './services/discovery/inventory-items';

/**
 * Agent-facing result shapes for the MCP tools. The REST routes return full
 * rows; here each result keeps only what the agent needs to pick its next
 * action (no normalized paths, timestamps it can't act on, echoed input).
 */

/** Drops null/undefined keys so absent values cost the agent no tokens. */
const compact = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;

const attempt = (item: DiscoveryQueueItem) =>
  `${item.attemptCount}/${item.maxAttempts}`;

/** What is left after this claim: the agent's cue to continue or stop. */
const remaining = (counts: QueueCounts) => ({
  queued: counts.queued,
  inProgress: counts.in_progress,
  failed: counts.failed,
});

export const claimResult = (result: ClaimQueueItemResult) => {
  if (!('reason' in result)) {
    const { item } = result;

    return compact({
      id: item.id,
      path: item.path,
      reason: item.reason,
      claimToken: item.claimToken,
      leaseExpiresAt: item.leaseExpiresAt,
      attempt: attempt(item),
      lastError: item.lastError,
      jobId: result.job.id,
      sourceId: result.job.sourceId,
      jobRootPath: result.job.rootPath,
      remaining: remaining(result.queueCounts),
    });
  }

  return compact({
    idle: result.reason,
    // queue_empty: nothing left; otherwise work will reappear at retryAt.
    next: result.reason === 'queue_empty' ? 'stop' : 'wait',
    retryAt: result.retryAt,
    queueCounts: result.queueCounts,
  });
};

export const heartbeatResult = (item: DiscoveryQueueItem) => ({
  leaseExpiresAt: item.leaseExpiresAt,
});

export const completeResult = (
  item: DiscoveryQueueItem,
  children: { item: DiscoveryQueueItem; created: boolean }[],
  counts: QueueCounts,
) => ({
  status: item.status,
  remaining: remaining(counts),
  queued: children
    .filter((c) => c.created && c.item.status !== 'skipped')
    .map((c) => c.item.path),
  // Under an exclusion rule: enqueued already skipped.
  excluded: children
    .filter((c) => c.created && c.item.status === 'skipped')
    .map((c) => c.item.path),
  alreadyQueued: children.filter((c) => !c.created).length,
});

export const failResult = (item: DiscoveryQueueItem) =>
  compact({
    status: item.status,
    attempt: attempt(item),
    retryAt: item.status === 'queued' ? item.availableAt : undefined,
  });

export const releaseResult = (item: DiscoveryQueueItem) => ({
  status: item.status,
});

export const skipResult = (item: DiscoveryQueueItem, counts: QueueCounts) => ({
  status: item.status,
  remaining: remaining(counts),
});

const nested = ({ rootPath, kind, decision }: NestedInventoryItem) => ({
  rootPath,
  kind,
  decision,
});

export const proposeResult = (results: ProposedInventoryItem[]) =>
  results.map(({ inventoryItem, created, changed, coveredBy, covers }) => ({
    id: inventoryItem.id,
    rootPath: inventoryItem.rootPath,
    created,
    changed,
    decision: inventoryItem.decision,
    coveredBy: coveredBy.map(nested),
    covers: covers.map(nested),
  }));

export const inventoryListResult = (
  { items, total }: { items: InventoryItem[]; total: number },
  limit: number,
) => ({
  total,
  items: items.map((i) =>
    compact({
      id: i.id,
      rootPath: i.rootPath,
      kind: i.kind,
      recommendation: i.recommendation,
      confidence: i.confidence,
      decision: i.decision,
      decisionNote: i.decisionNote,
      summary: i.summary,
    }),
  ),
  // Cursor for `after`; present only when the page was full.
  next:
    items.length >= limit
      ? items[items.length - 1].normalizedRootPath
      : undefined,
});

export const knownSkipsResult = (skips: KnownSkip[]) =>
  skips.map(({ path, pattern, count, reason, skippedAt }) =>
    compact({ path, pattern, count, reason, skippedAt }),
  );

type RuleRow = {
  id: string;
  sourceId: string | null;
  path: string;
  scope: string;
  reason: string | null;
};

export const ruleResult = (rule: RuleRow) =>
  compact({
    id: rule.id,
    path: rule.path,
    scope: rule.scope,
    reason: rule.reason,
    global: rule.sourceId === null ? true : undefined,
  });

type JobRow = {
  id: string;
  sourceId: string;
  rootPath: string;
  status: string;
  error: string | null;
};

export const jobResult = (
  job: JobRow & {
    sourceName?: string;
    queueCounts?: unknown;
    phase?: string | null;
    staleClaims?: number;
  },
) =>
  compact({
    id: job.id,
    sourceId: job.sourceId,
    sourceName: job.sourceName,
    rootPath: job.rootPath,
    status: job.status,
    error: job.error,
    phase: job.phase,
    staleClaims: job.staleClaims || undefined,
    queueCounts: job.queueCounts,
  });
