import { formatDuration } from '../../exodus/lib/job-display';
import { formatBytes } from '../../infra/cluster-map/lib/format-bytes';

/** `102ms` under a second, otherwise `1m 5s`; `—` when either end is missing. */
export function formatRunTime(
  startIso: string | undefined,
  endIso: string | undefined,
): string {
  if (!startIso || !endIso) return '—';

  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) return '—';

  return ms < 1000 ? `${ms}ms` : formatDuration(startIso, endIso);
}

/** Bytes per second as `4.1 MiB/s`. */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** Time left as `1h 5m` / `4m 3s` / `12s`; `—` when unknown. */
export function formatEta(seconds: number | null): string {
  if (seconds === null) return '—';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
