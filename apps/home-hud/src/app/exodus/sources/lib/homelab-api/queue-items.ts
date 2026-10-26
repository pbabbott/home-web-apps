import { HOMELAB_API_URL } from './config';
import type { DiscoveryJobStatus } from './discovery-jobs';
import { getJson } from './http';

export type QueueItemStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/** Item counts by status for one job's queue. */
export type QueueCounts = Record<QueueItemStatus, number>;

export interface QueueItem {
  id: string;
  /** The job this directory belongs to; only items of an active job can be retried. */
  jobId: string;
  path: string;
  status: QueueItemStatus;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  /** Worker holding the lease right now; null unless in progress. */
  claimedBy: string | null;
  /** Worker that held the most recent claim; survives release, expiry and failure. */
  lastClaimedBy: string | null;
  /** When the current lease runs out; null unless in progress. */
  leaseExpiresAt: string | null;
  updatedAt: string;
  priority: number;
  /** Why the directory was queued, written by whoever queued it. */
  reason: string | null;
  /** What the worker concluded about the directory; null until completed. */
  result: QueueItemResult | null;
  /** Inventory items this directory last proposed or added; a later job may take one over. */
  inventoryCount: number;
  createdAt: string;
  completedAt: string | null;
}

/** A job's queue item, as listed on the job page. */
export interface JobQueueItem extends QueueItem {
  /** Whether a human dealt with every skip; null until the directory has a result. */
  skipsReviewed: boolean | null;
}

/** What a human has done about each skip of a directory. */
export interface SkipReview {
  /** Null when the directory has no result yet. */
  reviewed: boolean | null;
  /** One per `result.skipped`, in order. */
  paths: { path: string; acknowledged: boolean; inventoried: boolean }[];
  /** One per `result.skippedGroups`, in order. */
  patterns: { pattern: string; acknowledged: boolean }[];
}

export interface QueueItemDetail extends QueueItem {
  job: {
    id: string;
    sourceId: string;
    rootPath: string;
    status: DiscoveryJobStatus;
  };
  skipReview: SkipReview;
  /** The directory itself is an approved inventory item. */
  directoryApproved: boolean;
}

export interface QueueItemResult {
  summary?: string;
  /** Paths seen and deliberately not explored. */
  skipped: { path: string; reason: string }[];
  /** Many similar direct entries skipped by name pattern. */
  skippedGroups?: { pattern: string; count?: number; reason: string }[];
  /** Child directories the agent could not read; also failed queue items. */
  unreadable?: { path: string; error: string }[];
}

/** What a skipped pattern matched in its directory, read live from the source. */
export interface SkippedGroupMatches {
  path: string;
  pattern: string;
  /** Matches found, before the API's cap. */
  total: number;
  truncated: boolean;
  entries: {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    /** Source-local time without a zone, e.g. `2025-01-15T09:05:00`. */
    modifiedAt: string | null;
  }[];
}

/** The API returns at most this many queue items for a job. */
export const JOB_QUEUE_ITEMS_LIMIT = 500;

/** A job's queue items, oldest first, optionally only those with `status`. */
export async function getJobQueueItems(
  jobId: string,
  status?: QueueItemStatus,
): Promise<JobQueueItem[]> {
  const params = new URLSearchParams(status ? { status } : {});

  return getJson<JobQueueItem[]>(
    `/discovery-jobs/${jobId}/queue-items?${params}`,
  );
}

export async function getQueueItem(id: string): Promise<QueueItemDetail> {
  return getJson<QueueItemDetail>(`/queue-items/${id}`);
}

export async function getQueueItems(
  sourceId: string,
  status: QueueItemStatus,
): Promise<QueueItem[]> {
  const params = new URLSearchParams({ status });

  const res = await fetch(
    `${HOMELAB_API_URL}/sources/${sourceId}/queue-items?${params}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /sources/${sourceId}/queue-items returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as QueueItem[];
}
