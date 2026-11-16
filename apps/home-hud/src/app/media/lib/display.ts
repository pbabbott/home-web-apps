import { formatDuration } from '../../exodus/lib/job-display';

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
