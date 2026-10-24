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

/**
 * Elapsed time between two ISO timestamps as `1h 5m 3s`, or `—` while the job
 * has not finished (or a timestamp is unparseable).
 */
export function formatDuration(
  startIso: string,
  endIso: string | null,
): string {
  if (!endIso) return '—';

  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) return '—';

  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [
    hours > 0 ? `${hours}h` : '',
    minutes > 0 ? `${minutes}m` : '',
    seconds > 0 || total === 0 ? `${seconds}s` : '',
  ].filter(Boolean);

  return parts.join(' ');
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

/**
 * `path` relative to the directory it was found in, so a row inside an
 * expanded `C:\backup-test\x` item reads `y\z` rather than the full path.
 * Falls back to the full path when it is not under `directory`.
 */
export function relativeToDirectory(directory: string, path: string): string {
  const base = directory.replace(/[\\/]+$/, '');
  const startsWithBase =
    path.slice(0, base.length).toLowerCase() === base.toLowerCase();
  const rest = path.slice(base.length);

  return startsWithBase && /^[\\/]/.test(rest) ? rest.slice(1) : path;
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
