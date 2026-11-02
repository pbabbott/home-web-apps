import {
  getDiscoveryJobById,
  getQueueItemById,
  DiscoveryError,
} from '@abbottland/homelab-db';
import { db } from '../../db';
import {
  ConnectionError,
  getConnectionDriver,
} from '@abbottland/source-access';
import { HttpError } from '../../lib/http-error';
import { matchesNamePattern } from '../../lib/name-pattern';
import { loadTarget, withKeyErrors } from './source-connections';

const MAX_PATTERN_MATCHES = 1000;

export type SkippedGroupMatches = {
  path: string;
  pattern: string;
  /** Matches found, before the cap. */
  total: number;
  truncated: boolean;
  entries: {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: string | null;
  }[];
};

/**
 * Lists the entries of a queue item's directory that one of its skipped
 * patterns matches, so a reviewer can see what the pattern excluded. Only a
 * pattern the worker recorded on the item is listed, so this cannot be used
 * to browse the machine.
 */
export const listSkippedGroupMatches = (
  queueItemId: string,
  pattern: string,
): Promise<SkippedGroupMatches> =>
  withKeyErrors(async () => {
    const item = await getQueueItemById(db, queueItemId);

    if (!item) throw new DiscoveryError('not_found', 'queue item not found');

    if (
      !item.result?.skippedGroups?.some((group) => group.pattern === pattern)
    ) {
      throw new HttpError(403, 'This pattern was not skipped for this item');
    }

    const job = await getDiscoveryJobById(db, item.jobId);

    if (!job) throw new DiscoveryError('not_found', 'job not found');

    const { connection, target } = await loadTarget(job.sourceId);

    try {
      const matches = (
        await getConnectionDriver(connection.connectionType).list(
          target,
          item.path,
        )
      )
        .filter((entry) => matchesNamePattern(pattern, entry.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      const base = item.path.replace(/\\+$/, '');

      return {
        path: item.path,
        pattern,
        total: matches.length,
        truncated: matches.length > MAX_PATTERN_MATCHES,
        entries: matches.slice(0, MAX_PATTERN_MATCHES).map((entry) => ({
          ...entry,
          path: `${base}\\${entry.name}`,
        })),
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
