import {
  findNestedInventoryItems,
  getDiscoveryJobById,
  getQueueItemById,
  listAcknowledgedSkipKeys,
  listExclusionRules,
  listInventoryUnder,
  listJobQueueStatusesAt,
  resolveExclusion,
  DiscoveryError,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import {
  ConnectionError,
  getConnectionDriver,
  normalizeWindowsPath,
} from '@abbottland/source-access';
import { HttpError } from '../../lib/http-error';
import { childOf, classifyEntries, type DiskEntry } from './disk-coverage';
import { reviewSkips } from './skip-review';
import { ancestorsOf, loadTarget, withKeyErrors } from './source-connections';

const MAX_DISK_ENTRIES = 2000;

export type DirectoryListing = {
  path: string;
  /** Entries found, before the cap. */
  total: number;
  truncated: boolean;
  /** Entries nothing accounts for: no inventory item, skip, queue item or rule. */
  uncovered: number;
  entries: DiskEntry[];
};

/**
 * Lists the direct children of a queue item's directory over the source's
 * connection and says how each is accounted for (inventory item, skip, queue
 * item of its own, exclusion rule), so a reviewer can find what was missed.
 * Only the item's own directory is listed, so this cannot browse the machine.
 */
export const getDirectoryListing = (
  queueItemId: string,
): Promise<DirectoryListing> =>
  withKeyErrors(async () => {
    const item = await getQueueItemById(db, queueItemId);

    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    const job = await getDiscoveryJobById(db, item.jobId);

    if (!job) throw new DiscoveryError('not_found', 'job not found');

    const { connection, target } = await loadTarget(job.sourceId);

    try {
      const listed = (
        await getConnectionDriver(connection.connectionType).list(
          target,
          item.path,
        )
      ).sort((a, b) => a.name.localeCompare(b.name));
      const shown = listed.slice(0, MAX_DISK_ENTRIES);
      const normalizedDirectory = normalizeWindowsPath(
        item.path,
      ).normalizedPath;
      const [inventoryUnder, nested, queueStatuses, rules, acknowledged] =
        await Promise.all([
          listInventoryUnder(db, job.sourceId, normalizedDirectory),
          findNestedInventoryItems(
            db,
            job.sourceId,
            normalizedDirectory,
            ancestorsOf(normalizedDirectory),
          ),
          listJobQueueStatusesAt(
            db,
            job.id,
            shown.map((entry) => childOf(item.path, entry.name).normalizedPath),
          ),
          listExclusionRules(db, { sourceId: job.sourceId }),
          listAcknowledgedSkipKeys(db, job.sourceId, normalizedDirectory),
        ]);
      const { entries, uncovered } = classifyEntries({
        directory: item.path,
        entries: shown,
        inventoryUnder,
        coveredByInventoryParent: nested.coveredBy.length > 0,
        queueStatuses,
        isExcluded: (normalizedPath) =>
          resolveExclusion(rules, normalizedPath).state === 'excluded',
        result: item.result,
        skipReview: reviewSkips(item.path, item.result, {
          acknowledged: new Set(acknowledged),
          inventoried: new Set(inventoryUnder.map((i) => i.normalizedRootPath)),
        }),
      });

      return {
        path: item.path,
        total: listed.length,
        truncated: listed.length > MAX_DISK_ENTRIES,
        uncovered,
        entries,
      };
    } catch (err) {
      if (err instanceof ConnectionError) {
        if (err.code === 'not_found') {
          throw new DiscoveryError('not_found', err.message);
        }
        throw new HttpError(502, err.message);
      }
      throw err;
    }
  });
