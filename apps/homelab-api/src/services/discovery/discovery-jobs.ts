import {
  DiscoveryError,
  completeDiscoveryJob,
  createDiscoveryJob as createDiscoveryJobRow,
  getDiscoveryJobById,
  getQueueSummaries,
  getSourceById,
  listAllDiscoveryJobs as listAllDiscoveryJobRows,
  listDiscoveryJobs as listDiscoveryJobRows,
  transitionDiscoveryJob,
  type DiscoveryJob,
  type DiscoveryJobWithSource,
  type QueueSummary,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { toQueuePath } from './paths';

/**
 * A job with its queue at a glance: `queueCounts` (`failed` > 0 on a finished
 * job means it finished with failures), `staleClaims` (expired leases not yet
 * reclaimed), the agent's last activity and worker, and for an active job its
 * `phase`.
 */
export type DiscoveryJobWithCounts = DiscoveryJob & QueueSummary;

const summarize = async <T extends DiscoveryJob>(
  jobs: T[],
): Promise<(T & QueueSummary)[]> => {
  const summaries = await getQueueSummaries(db, jobs);

  return jobs.map((job) => ({
    ...job,
    ...(summaries.get(job.id) as QueueSummary),
  }));
};

const withCounts = async (job: DiscoveryJob): Promise<DiscoveryJobWithCounts> =>
  (await summarize([job]))[0];

export const requireJob = async (id: string): Promise<DiscoveryJob> => {
  const job = await getDiscoveryJobById(db, id);
  if (!job) throw new DiscoveryError('not_found', 'discovery job not found');

  return job;
};

export async function createDiscoveryJob(
  sourceId: string,
  rootPath: string,
): Promise<DiscoveryJobWithCounts> {
  const root = toQueuePath(rootPath);
  const job = await createDiscoveryJobRow(db, { sourceId, root });

  return withCounts(job);
}

export async function listAllJobs(
  sourceId?: string,
): Promise<(DiscoveryJobWithSource & QueueSummary)[]> {
  return summarize(await listAllDiscoveryJobRows(db, { sourceId }));
}

export async function listSourceJobs(
  sourceId: string,
): Promise<DiscoveryJobWithCounts[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return summarize(await listDiscoveryJobRows(db, sourceId));
}

export async function getDiscoveryJob(
  id: string,
): Promise<DiscoveryJobWithCounts> {
  return withCounts(await requireJob(id));
}

export async function completeJob(id: string): Promise<DiscoveryJobWithCounts> {
  return withCounts(await completeDiscoveryJob(db, id));
}

export async function cancelJob(id: string): Promise<DiscoveryJobWithCounts> {
  return withCounts(await transitionDiscoveryJob(db, id, 'cancelled'));
}

export async function failJob(
  id: string,
  error: string,
): Promise<DiscoveryJobWithCounts> {
  return withCounts(await transitionDiscoveryJob(db, id, 'failed', error));
}
