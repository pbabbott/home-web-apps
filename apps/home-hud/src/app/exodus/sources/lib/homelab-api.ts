const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export type SourceType = 'windows';

export interface Source {
  id: string;
  name: string;
  /** Joins to a registered host (`Host.id`) for the machine's name/IP; null if not linked to one. */
  hostId: string | null;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
}

export async function getSources(): Promise<Source[]> {
  const res = await fetch(`${HOMELAB_API_URL}/sources`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`homelab-api GET /sources returned ${res.status}: ${body}`);
  }

  return (await res.json()) as Source[];
}

export type DiscoveryJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A job still being worked on — it blocks starting another for the same source. */
export function isActiveJob(job: { status: DiscoveryJobStatus }): boolean {
  return job.status === 'pending' || job.status === 'running';
}

export interface DiscoveryJob {
  id: string;
  sourceId: string;
  rootPath: string;
  status: DiscoveryJobStatus;
  /** Set when the job was marked failed. */
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type QueueItemStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/** Item counts by status for one job's queue. */
export type QueueCounts = Record<QueueItemStatus, number>;

export interface DiscoveryJobWithCounts extends DiscoveryJob {
  queueCounts: QueueCounts;
}

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
}

/** A source's jobs, newest first. */
export async function getDiscoveryJobs(
  sourceId: string,
): Promise<DiscoveryJob[]> {
  const res = await fetch(
    `${HOMELAB_API_URL}/sources/${sourceId}/discovery-jobs`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /sources/${sourceId}/discovery-jobs returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as DiscoveryJob[];
}

export async function getDiscoveryJob(
  id: string,
): Promise<DiscoveryJobWithCounts> {
  const res = await fetch(`${HOMELAB_API_URL}/discovery-jobs/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /discovery-jobs/${id} returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as DiscoveryJobWithCounts;
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

export interface DiscoveryJobWithSource extends DiscoveryJob {
  sourceName: string;
  /** The host the job's source is linked to, if any. */
  hostId: string | null;
}

/** Jobs across every source, newest first; optionally only those of `sourceId`. */
export async function getAllDiscoveryJobs(
  sourceId?: string,
): Promise<DiscoveryJobWithSource[]> {
  const params = new URLSearchParams(sourceId ? { sourceId } : {});

  const res = await fetch(`${HOMELAB_API_URL}/discovery-jobs?${params}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /discovery-jobs returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as DiscoveryJobWithSource[];
}

export type InventoryItemType = 'file' | 'directory';

export interface InventoryItem {
  id: string;
  itemType: InventoryItemType;
  path: string;
  /** Lowercased path; the cursor for the next page. */
  normalizedPath: string;
  parentPath: string | null;
  name: string;
  extension: string | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface InventoryQuery {
  /** Only direct children of this directory. */
  parentPath?: string;
  /** Items at or beneath this path. */
  pathPrefix?: string;
  itemType?: InventoryItemType;
  /** The `normalizedPath` of the last item of the previous page. */
  after?: string;
  limit?: number;
}

/** A page of a source's inventory, ordered by normalized path. */
export async function getInventoryItems(
  sourceId: string,
  query: InventoryQuery,
): Promise<InventoryItem[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const res = await fetch(
    `${HOMELAB_API_URL}/sources/${sourceId}/inventory-items?${params}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /sources/${sourceId}/inventory-items returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as InventoryItem[];
}
