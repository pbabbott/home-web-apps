import {
  listDiscoveryJobs,
  listQueueItems,
  type DiscoveryJobStatus,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { loadReviewContext } from '../discovery/queue-items';
import { directoryReviewed, reviewSkips } from '../discovery/skip-review';

/** `listQueueItems` returns at most this many directories. */
const QUEUE_ITEMS_CAP = 500;

export type DiscoveryReviewSummary = {
  /** The source’s newest discovery job; null when it has none. */
  job: { id: string; rootPath: string; status: DiscoveryJobStatus } | null;
  directories: {
    /** Skips reviewed, no inventory decision pending and the on-disk contents acknowledged. */
    reviewed: number;
    notReviewed: number;
    /** Explored directories with no result to review. */
    unknown: number;
    /** Not explored (queued, in progress, failed or skipped). */
    notExplored: number;
  };
  /** The job has more directories than are counted here. */
  truncated: boolean;
};

/**
 * How far a human got with reviewing what discovery skipped, for the
 * source’s newest discovery job. Display only: it never changes
 * `allAccounted`, because skipped paths are the discovery workflow’s business.
 */
export async function getDiscoveryReviewSummary(
  sourceId: string,
): Promise<DiscoveryReviewSummary> {
  const [job] = await listDiscoveryJobs(db, sourceId);
  const directories = {
    reviewed: 0,
    notReviewed: 0,
    unknown: 0,
    notExplored: 0,
  };
  if (!job) return { job: null, directories, truncated: false };

  const [items, context] = await Promise.all([
    listQueueItems(db, { jobId: job.id }),
    loadReviewContext(sourceId, job.rootPath),
  ]);

  for (const item of items) {
    if (item.status !== 'completed') {
      directories.notExplored++;
      continue;
    }
    const reviewed = directoryReviewed(
      reviewSkips(item.path, item.result, context),
      item.inventoryByDecision.pending,
      context.onDiskReviewed.has(item.normalizedPath),
    );
    if (reviewed === null) directories.unknown++;
    else if (reviewed) directories.reviewed++;
    else directories.notReviewed++;
  }

  return {
    job: { id: job.id, rootPath: job.rootPath, status: job.status },
    directories,
    truncated: items.length >= QUEUE_ITEMS_CAP,
  };
}
