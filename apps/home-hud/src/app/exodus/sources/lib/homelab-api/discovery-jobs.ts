import { HOMELAB_API_URL } from './config';
import type { QueueCounts } from './queue-items';

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

export interface DiscoveryJobWithCounts extends DiscoveryJob {
  queueCounts: QueueCounts;
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
