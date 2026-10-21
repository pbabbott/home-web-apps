import type { BadgeColor } from '@abbottland/fui-components';
import type {
  DiscoveryJobStatus,
  QueueItemResult,
  QueueItemStatus,
} from '../sources/lib/homelab-api';

export const JOB_STATUS_COLOR: Record<DiscoveryJobStatus, BadgeColor> = {
  pending: 'warning',
  running: 'secondary',
  completed: 'success',
  failed: 'error',
  cancelled: 'dark',
};

/**
 * Date and time in UTC (column headers say so), formatted by hand so server
 * and client renders match. No trailing "Z": the pixel font draws it like a
 * digit.
 */
export function formatDateTime(iso: string | null): string {
  return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '—';
}

export const QUEUE_STATUS_COLOR: Record<QueueItemStatus, BadgeColor> = {
  queued: 'warning',
  in_progress: 'secondary',
  completed: 'success',
  failed: 'error',
  skipped: 'dark',
};

const QUEUE_STATUSES = Object.keys(QUEUE_STATUS_COLOR) as QueueItemStatus[];

/** A `?status=` value, or undefined for anything that is not a queue item status. */
export function parseQueueStatus(
  value: string | undefined,
): QueueItemStatus | undefined {
  return QUEUE_STATUSES.find((status) => status === value);
}

/** `/exodus/jobs/<id>`, optionally filtered to one queue item status. */
export function jobDetailUrl(jobId: string, status?: QueueItemStatus): string {
  return status
    ? `/exodus/jobs/${jobId}?status=${status}`
    : `/exodus/jobs/${jobId}`;
}

/** `*.msi ×212`, or just the pattern when the agent did not count. */
export function describeSkippedGroup(group: {
  pattern: string;
  count?: number;
}): string {
  return group.count === undefined
    ? group.pattern
    : `${group.pattern} ×${group.count}`;
}

/** One line for the table: `3 skipped, 2 patterns`, or an empty string when nothing was skipped. */
export function describeSkips(result: QueueItemResult | null): string {
  if (!result) return '';

  const parts: string[] = [];
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} skipped`);
  }

  const groups = result.skippedGroups?.length ?? 0;
  if (groups > 0) {
    parts.push(`${groups} ${groups === 1 ? 'pattern' : 'patterns'}`);
  }

  return parts.join(', ');
}

/** Splits a textarea into trimmed, non-empty lines. */
export function parsePathLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
