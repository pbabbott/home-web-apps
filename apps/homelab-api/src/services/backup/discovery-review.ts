import { listDiscoveryJobs, listQueueItems } from '@abbottland/homelab-db';
import { db } from '../../db';
import { loadReviewContext } from '../discovery/queue-items';
import { directoryReviewed, reviewSkips } from '../discovery/skip-review';

/** `listQueueItems` returns at most this many directories per job. */
const QUEUE_ITEMS_CAP = 500;

export type DiscoveryReviewSummary = {
  /** The source’s completed discovery jobs, newest first. */
  jobs: { id: string; rootPath: string; truncated: boolean }[];
  /** Each directory counted once, from the newest completed job that has it. */
  directories: {
    /** Skips reviewed, no inventory decision pending and the on-disk contents acknowledged. */
    reviewed: number;
    notReviewed: number;
    /** Explored directories with no result to review. */
    unknown: number;
    /** Not explored (queued, in progress, failed or skipped). */
    notExplored: number;
  };
  /** Some job has more directories than are counted here. */
  truncated: boolean;
};

/**
 * How far a human got with reviewing what discovery skipped, across all of
 * the source’s completed discovery jobs. Display only: it never changes
 * `allAccounted`, because skipped paths are the discovery workflow’s business.
 * Acknowledgements are kept per source and path, so a directory several jobs
 * visited is reviewed once and counted once.
 */
export async function getDiscoveryReviewSummary(
  sourceId: string,
): Promise<DiscoveryReviewSummary> {
  const jobs = (await listDiscoveryJobs(db, sourceId)).filter(
    (job) => job.status === 'completed',
  );
  const directories = {
    reviewed: 0,
    notReviewed: 0,
    unknown: 0,
    notExplored: 0,
  };
  const seen = new Set<string>();
  const summary: DiscoveryReviewSummary['jobs'] = [];

  for (const job of jobs) {
    const [items, context] = await Promise.all([
      listQueueItems(db, { jobId: job.id }),
      loadReviewContext(sourceId, job.rootPath),
    ]);

    for (const item of items) {
      if (seen.has(item.normalizedPath)) continue;
      seen.add(item.normalizedPath);

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

    summary.push({
      id: job.id,
      rootPath: job.rootPath,
      truncated: items.length >= QUEUE_ITEMS_CAP,
    });
  }

  return {
    jobs: summary,
    directories,
    truncated: summary.some((job) => job.truncated),
  };
}
