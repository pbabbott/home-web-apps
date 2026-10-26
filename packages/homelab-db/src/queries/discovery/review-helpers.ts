import { eq } from 'drizzle-orm';
import { discoveryJobs, discoveryQueueItems } from '../../schema/discovery';
import type { Actor } from '../audit';
import { DiscoveryError, type Tx } from '../shared';

/** Reviewing is a human act: an agent's actor is refused. */
export const assertHuman = (actor: Actor, action: string) => {
  if (actor.type !== 'human') {
    throw new DiscoveryError('conflict', `only a human can ${action}`);
  }
};

/** The source and job a queue item belongs to, or `not_found`. */
export const sourceOfQueueItem = async (
  tx: Tx,
  queueItemId: string,
): Promise<{ sourceId: string; jobId: string }> => {
  const [queued] = await tx
    .select({
      jobId: discoveryQueueItems.jobId,
      sourceId: discoveryJobs.sourceId,
    })
    .from(discoveryQueueItems)
    .innerJoin(discoveryJobs, eq(discoveryJobs.id, discoveryQueueItems.jobId))
    .where(eq(discoveryQueueItems.id, queueItemId));

  if (!queued) throw new DiscoveryError('not_found', 'queue item not found');

  return queued;
};
