import {
  DiscoveryError,
  completeDiscoveryJob,
  createDiscoveryJob as createDiscoveryJobRow,
  getDiscoveryJobById,
  getQueueCounts,
  getSourceById,
  listAllDiscoveryJobs as listAllDiscoveryJobRows,
  listDiscoveryJobs as listDiscoveryJobRows,
  transitionDiscoveryJob,
  type DiscoveryJob,
  type DiscoveryJobWithSource,
  type QueueCounts,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { toInventoryPath, toQueuePath } from './paths';

export type DiscoveryJobWithCounts = DiscoveryJob & {
  /** This job's item counts by status; `failed` > 0 means "finished with failures". */
  queueCounts: QueueCounts;
};

const withCounts = async (
  job: DiscoveryJob,
): Promise<DiscoveryJobWithCounts> => ({
  ...job,
  queueCounts: await getQueueCounts(db, job.id),
});

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
  const job = await createDiscoveryJobRow(db, {
    sourceId,
    root,
    rootInventory: toInventoryPath({ path: rootPath, itemType: 'directory' }),
  });

  return withCounts(job);
}

export const listAllJobs = (
  sourceId?: string,
): Promise<DiscoveryJobWithSource[]> =>
  listAllDiscoveryJobRows(db, { sourceId });

export async function listSourceJobs(
  sourceId: string,
): Promise<DiscoveryJob[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listDiscoveryJobRows(db, sourceId);
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
