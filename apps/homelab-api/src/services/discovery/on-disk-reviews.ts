import {
  DiscoveryError,
  getSourceById,
  listOnDiskReviews as listOnDiskReviewRows,
  reviewOnDisk as reviewOnDiskRow,
  unreviewOnDisk as unreviewOnDiskRow,
  type Actor,
  type OnDiskReview,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import { normalizeWindowsPath } from '../../lib/windows-path';

/** A human says they reviewed what is on disk in the queue item's directory. Idempotent. */
export const reviewOnDisk = (
  queueItemId: string,
  actor: Actor,
): Promise<OnDiskReview> => reviewOnDiskRow(db, queueItemId, actor);

/** Takes that review back. */
export const unreviewOnDisk = (
  queueItemId: string,
  actor: Actor,
): Promise<void> => unreviewOnDiskRow(db, queueItemId, actor);

export async function listSourceOnDiskReviews(
  sourceId: string,
  filters: { pathPrefix?: string; limit?: number },
): Promise<OnDiskReview[]> {
  if (!(await getSourceById(db, sourceId))) {
    throw new DiscoveryError('not_found', 'source not found');
  }

  return listOnDiskReviewRows(db, {
    sourceId,
    normalizedPathPrefix: filters.pathPrefix
      ? normalizeWindowsPath(filters.pathPrefix).normalizedPath
      : undefined,
    limit: filters.limit,
  });
}
