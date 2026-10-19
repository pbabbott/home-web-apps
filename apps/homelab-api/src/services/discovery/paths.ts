import type { QueuePath } from '@abbottland/homelab-db';
import { normalizeWindowsPath } from '../../lib/windows-path';

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
