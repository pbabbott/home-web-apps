import { DiscoveryError, type QueuePath } from '@abbottland/homelab-db';
import { isWithinPath, normalizeWindowsPath } from '../../lib/windows-path';

export const toQueuePath = (path: string): QueuePath =>
  normalizeWindowsPath(path);

/** A follow-up as sent by the agent: a bare path or a path with a reason and priority. */
export type FollowUpInput =
  | string
  | { path: string; reason?: string; priority?: number };

export const toFollowUpPath = (input: FollowUpInput): QueuePath =>
  typeof input === 'string'
    ? toQueuePath(input)
    : {
        ...toQueuePath(input.path),
        reason: input.reason,
        priority: input.priority,
      };

/**
 * Throws a conflict unless every path lies beneath the directory a worker has
 * claimed (the directory itself too when `allowSelf`). `subject` names the
 * paths in the message, e.g. `skipped paths`.
 */
export const assertWithinClaimedDirectory = (
  claimed: { path: string; normalizedPath: string },
  paths: { path: string; normalizedPath: string }[],
  { allowSelf, subject }: { allowSelf: boolean; subject: string },
): void => {
  const outside = paths.filter((p) =>
    p.normalizedPath === claimed.normalizedPath
      ? !allowSelf
      : !isWithinPath(claimed.normalizedPath, p.normalizedPath),
  );

  if (outside.length > 0) {
    throw new DiscoveryError(
      'conflict',
      `${subject} are not inside the claimed directory ${claimed.path}`,
      { paths: outside.map((p) => p.path) },
    );
  }
};
