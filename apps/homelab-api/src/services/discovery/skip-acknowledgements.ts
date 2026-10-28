import {
  acknowledgeSkip as acknowledgeSkipRow,
  unacknowledgeSkip as unacknowledgeSkipRow,
  listSkipAcknowledgements as listSkipAcknowledgementRows,
  getQueueItemById,
  getSourceById,
  DiscoveryError,
  type Actor,
  type SkipAcknowledgement,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { normalizeWindowsPath } from '@abbottland/source-access';
import type { SkipAcknowledgementBody } from '../../schemas/discovery';
import { assertWithinClaimedDirectory } from './paths';

/** Resolves a body to the queue item's source-relative key, or throws. */
const resolveSkip = async (
  queueItemId: string,
  body: SkipAcknowledgementBody,
  actor: Actor,
) => {
  const queueItem = await getQueueItemById(db, queueItemId);
  if (!queueItem) throw new DiscoveryError('not_found', 'queue item not found');

  const { path, normalizedPath } = normalizeWindowsPath(body.path);

  // A pattern skip is keyed on the directory itself; a path skip is beneath it.
  assertWithinClaimedDirectory(queueItem, [{ path, normalizedPath }], {
    allowSelf: body.pattern !== undefined,
    subject: 'acknowledged paths',
  });

  return { path, normalizedPath, pattern: body.pattern, actor };
};

/** A human agrees with the agent's skip of a path or pattern. Idempotent. */
export async function acknowledgeSkip(
  queueItemId: string,
  body: SkipAcknowledgementBody,
  actor: Actor,
): Promise<SkipAcknowledgement> {
  return acknowledgeSkipRow(
    db,
    queueItemId,
    await resolveSkip(queueItemId, body, actor),
  );
}

/** Takes an acknowledgement back. */
export async function unacknowledgeSkip(
  queueItemId: string,
  body: SkipAcknowledgementBody,
  actor: Actor,
): Promise<void> {
  await unacknowledgeSkipRow(
    db,
    queueItemId,
    await resolveSkip(queueItemId, body, actor),
  );
}

export async function listSourceSkipAcknowledgements(
  sourceId: string,
  filters: { pathPrefix?: string; limit?: number },
): Promise<SkipAcknowledgement[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listSkipAcknowledgementRows(db, {
    sourceId,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    limit: filters.limit,
  });
}
