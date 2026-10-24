import type { BadgeColor } from '@abbottland/fui-components';
import type {
  DiscoveryJobStatus,
  QueueCounts,
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
 * Date and time in the runtime's local zone on a 12-hour clock:
 * `2026-10-24 3:05 PM`, or `3:05:09 PM` with `seconds`. The server's zone
 * differs from the browser's, so render it through `LocalDateTime` rather than
 * calling this during SSR, or the markup will mismatch.
 */
export function formatLocalDateTime(
  iso: string | null,
  options: { seconds?: boolean; dateOnly?: boolean } = {},
): string {
  if (!iso) return '—';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (options.dateOnly) return day;

  const hour = date.getHours();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const clock = `${hour12}:${pad(date.getMinutes())}${options.seconds ? `:${pad(date.getSeconds())}` : ''}`;

  return `${day} ${clock} ${hour >= 12 ? 'PM' : 'AM'}`;
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

/** `file` when the last path segment has an extension, else `directory`. A guess the user can change. */
export function guessKind(path: string): 'file' | 'directory' {
  const name =
    path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? '';

  return /.\.[^.]+$/.test(name) ? 'file' : 'directory';
}

/** Splits a textarea into trimmed, non-empty lines. */
export function parsePathLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Where an active job stands, so a person can tell waiting on the agent from waiting on them. */
export type JobPhase =
  | 'work_remaining'
  | 'stuck_claims'
  | 'awaiting_completion';

export interface JobPhaseInfo {
  phase: JobPhase;
  label: string;
  detail: string;
  color: BadgeColor;
}

/** True once an in-progress item's lease has run out: its worker is gone and the next claim reclaims it. */
export function isStaleClaim(
  item: { status: QueueItemStatus; leaseExpiresAt: string | null },
  now: number,
): boolean {
  return (
    item.status === 'in_progress' &&
    item.leaseExpiresAt !== null &&
    Date.parse(item.leaseExpiresAt) < now
  );
}

const directories = (n: number) =>
  `${n} ${n === 1 ? 'directory' : 'directories'}`;

/**
 * `staleClaims` is how many in-progress items have an expired lease; callers
 * that cannot see lease times pass 0. Stuck claims win over remaining work
 * because they need a worker to come back, not just time.
 */
export function jobPhase(
  counts: QueueCounts,
  staleClaims: number,
): JobPhaseInfo {
  if (staleClaims > 0) {
    return {
      phase: 'stuck_claims',
      label: 'Stuck claims',
      detail: `${directories(staleClaims)} held by a worker whose lease expired. The next claim returns ${staleClaims === 1 ? 'it' : 'them'} to the queue.`,
      color: 'error',
    };
  }

  if (counts.queued > 0 || counts.in_progress > 0) {
    return {
      phase: 'work_remaining',
      label: 'Work remaining',
      detail: `${counts.queued} queued, ${counts.in_progress} in progress. The agent is still exploring.`,
      color: 'secondary',
    };
  }

  return {
    phase: 'awaiting_completion',
    label: 'Awaiting completion',
    detail:
      counts.failed > 0
        ? `Discovery finished with ${`${directories(counts.failed)} failed`}. Retry them, or mark the job complete.`
        : 'Discovery finished. Mark the job complete when you are done reviewing.',
    color: counts.failed > 0 ? 'warning' : 'success',
  };
}

/** Finished directories (completed or skipped) out of every directory discovered so far; the total grows while the agent explores. */
export function jobProgress(counts: QueueCounts): {
  done: number;
  total: number;
  failed: number;
} {
  const total =
    counts.queued +
    counts.in_progress +
    counts.completed +
    counts.failed +
    counts.skipped;

  return {
    done: counts.completed + counts.skipped,
    total,
    failed: counts.failed,
  };
}

/** `just now`, `4 min ago`, `3 h ago`, `2 d ago`; `—` for no or an unparseable timestamp. */
export function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return '—';

  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  return `${Math.floor(hours / 24)} d ago`;
}

export type QueueMessageKind =
  | 'released'
  | 'expired'
  | 'cancelled'
  | 'skipped'
  | 'error';

/**
 * homelab-api records why an item left its claim in `lastError` as plain
 * text with a fixed prefix (`released by <worker>`, `lease expired …`,
 * `job cancelled|failed`, `skipped: <reason>`); anything else is a worker's
 * own error. Matching the prefix keeps those apart without a schema column.
 */
export function classifyQueueMessage(lastError: string): QueueMessageKind {
  if (lastError.startsWith('released by ')) return 'released';
  if (lastError.startsWith('lease expired')) return 'expired';
  if (/^job (cancelled|failed)$/.test(lastError)) return 'cancelled';
  if (lastError.startsWith('skipped: ')) return 'skipped';

  return 'error';
}

export const QUEUE_MESSAGE_LABEL: Record<
  Exclude<QueueMessageKind, 'error'>,
  { label: string; color: BadgeColor }
> = {
  released: { label: 'released', color: 'secondary' },
  expired: { label: 'lease expired', color: 'warning' },
  cancelled: { label: 'job ended', color: 'dark' },
  skipped: { label: 'skipped', color: 'dark' },
};

/** An active job a person should look at: stuck, drained and waiting on them, or carrying failures. */
export function needsAttention(job: {
  phase: JobPhase | null;
  queueCounts: QueueCounts;
}): boolean {
  if (job.phase === null) return false;

  return (
    job.phase === 'stuck_claims' ||
    job.phase === 'awaiting_completion' ||
    job.queueCounts.failed > 0
  );
}
