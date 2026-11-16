'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { OutlinedButton, Typography } from '@abbottland/fui-components';
import { refreshGluetunSyncLogs } from '../lib/actions';

interface GluetunSyncLogsProps {
  /** Null when the initial load failed. */
  initialLines: string[] | null;
}

export function GluetunSyncLogs({ initialLines }: GluetunSyncLogsProps) {
  const [lines, setLines] = useState<string[] | null>(initialLines);
  const [pending, startTransition] = useTransition();
  const logRef = useRef<HTMLPreElement>(null);

  // Newest lines are at the bottom, so keep that end in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const refresh = () => {
    startTransition(async () => {
      setLines(await refreshGluetunSyncLogs());
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Typography variant="h3" component="h3">
          gluetun-sync Logs
        </Typography>
        <OutlinedButton size="small" onClick={refresh} disabled={pending}>
          {pending ? 'Refreshing…' : 'Refresh'}
        </OutlinedButton>
      </div>
      {lines === null ? (
        <Typography variant="body2" className="text-neutral-400">
          Unavailable.
        </Typography>
      ) : lines.length === 0 ? (
        <Typography variant="body2" className="text-neutral-400">
          No log lines.
        </Typography>
      ) : (
        <pre
          ref={logRef}
          className="m-0 max-h-80 overflow-auto bg-neutral-900 p-3 font-mono text-xs leading-relaxed text-neutral-300"
        >
          {lines.join('\n')}
        </pre>
      )}
    </section>
  );
}
