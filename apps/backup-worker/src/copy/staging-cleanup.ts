import type { DestFs } from './dest-fs';
import { stagingDir } from './layout';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes the staging folders of items that are not being copied: the
 * leftovers of a cancelled job (its items are never claimed again) or of a
 * killed attempt whose item was handed out elsewhere. Run at startup, when no
 * item of this worker is in flight (one worker serves one destination). Names
 * that are not item ids are not ours and are left alone. Returns the item ids
 * cleaned.
 */
export const removeStaleStaging = async (
  dest: DestFs,
  isInProgress: (itemId: string) => Promise<boolean>,
): Promise<string[]> => {
  const removed: string[] = [];

  for (const name of await dest.listStaging()) {
    if (!UUID.test(name) || (await isInProgress(name))) continue;

    await dest.removeItemStaging(stagingDir(dest.baseRoot, name));
    removed.push(name);
  }
  if (removed.length > 0) await dest.removeStagingRootIfEmpty();

  return removed;
};
