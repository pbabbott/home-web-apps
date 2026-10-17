const HOMELAB_API_URL = process.env.HOMELAB_API_URL ?? 'http://localhost:4003';

export type BackupSourceType = 'windows';

export interface BackupSource {
  id: string;
  name: string;
  /** Joins to a registered host (`Host.id`) for the machine's name/IP; null if not linked to one. */
  hostId: string | null;
  sourceType: BackupSourceType;
  createdAt: string;
  updatedAt: string;
}

export async function getBackupSources(): Promise<BackupSource[]> {
  const res = await fetch(`${HOMELAB_API_URL}/backup-sources`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /backup-sources returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as BackupSource[];
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

/** Item counts by status. Source-wide: the queue belongs to the source, not one job. */
export type QueueCounts = Record<QueueItemStatus, number>;

export interface DiscoveryJobWithCounts extends DiscoveryJob {
  queueCounts: QueueCounts;
}

export interface QueueItem {
  id: string;
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
    `${HOMELAB_API_URL}/backup-sources/${sourceId}/discovery-jobs`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /backup-sources/${sourceId}/discovery-jobs returned ${res.status}: ${body}`,
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
    `${HOMELAB_API_URL}/backup-sources/${sourceId}/queue-items?${params}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `homelab-api GET /backup-sources/${sourceId}/queue-items returned ${res.status}: ${body}`,
    );
  }

  return (await res.json()) as QueueItem[];
}
