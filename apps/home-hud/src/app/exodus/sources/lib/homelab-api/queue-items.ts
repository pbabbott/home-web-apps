import { HOMELAB_API_URL } from './config';
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
  updatedAt: string;
  priority: number;
  /** Why the directory was queued, written by whoever queued it. */
  reason: string | null;
  /** What the worker concluded about the directory; null until completed. */
  result: QueueItemResult | null;
  createdAt: string;
  completedAt: string | null;
}

export interface QueueItemResult {
  summary?: string;
  /** Paths seen and deliberately not explored. */
  skipped: { path: string; reason: string }[];
  /** Many similar direct entries skipped by name pattern. */
  skippedGroups?: { pattern: string; count?: number; reason: string }[];
}

/** The API returns at most this many queue items for a job. */
export const JOB_QUEUE_ITEMS_LIMIT = 500;

/** A job's queue items, oldest first, optionally only those with `status`. */
export async function getJobQueueItems(
  jobId: string,
  status?: QueueItemStatus,
): Promise<QueueItem[]> {
  const params = new URLSearchParams(status ? { status } : {});

  return getJson<QueueItem[]>(`/discovery-jobs/${jobId}/queue-items?${params}`);
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
