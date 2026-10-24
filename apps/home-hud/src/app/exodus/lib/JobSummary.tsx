'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@abbottland/fui-components';
import { formatRelativeTime, jobPhase, jobProgress } from './job-display';
import type { JobQueueSummary } from '../sources/lib/homelab-api';

const RELATIVE_TICK_MS = 30_000;

/** Elapsed time since `iso`, kept current; `—` until mounted so it never mismatches server markup. */
export function RelativeTime({ iso }: { iso: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);

    return () => clearInterval(timer);
  }, [iso]);

  return <>{now === null ? '—' : formatRelativeTime(iso, now)}</>;
}

/** Where an active job stands; nothing for a finished job. */
export function JobPhaseBadge({ job }: { job: JobQueueSummary }) {
  if (job.phase === null) return null;

  const info = jobPhase(job.queueCounts, job.staleClaims);

  return <Badge color={info.color}>{info.label}</Badge>;
}

/** `12 / 20` finished of discovered, plus the failed count when any. */
export function JobProgress({ job }: { job: JobQueueSummary }) {
  const { done, total, failed } = jobProgress(job.queueCounts);

  return (
    <>
      {done} / {total}
      {failed > 0 && <span className="text-error-400"> · {failed} failed</span>}
    </>
  );
}

/** When the agent last touched the job and as whom. */
export function JobActivity({ job }: { job: JobQueueSummary }) {
  if (!job.lastActivityAt) return <>—</>;

  return (
    <>
      <RelativeTime iso={job.lastActivityAt} />
      {job.lastWorker && (
        <span className="break-all text-neutral-400"> · {job.lastWorker}</span>
      )}
    </>
  );
}
