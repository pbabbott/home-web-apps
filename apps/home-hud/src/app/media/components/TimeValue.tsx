'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { LocalDateTime } from '../../exodus/lib/LocalDateTime';
import { formatRelativeTime } from '../../exodus/lib/job-display';

const subscribeNever = () => () => {};

interface TimeValueProps {
  iso: string | undefined;
}

/** A timestamp in the viewer's zone with a relative line beneath; `—` when missing, and until hydrated so SSR markup matches. */
export function TimeValue({ iso }: TimeValueProps) {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  // Re-read only when the timestamp changes (a router.refresh() after a sync), not on a tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when the timestamp changes, which is when the data was refreshed
  const now = useMemo(() => Date.now(), [iso]);

  if (!iso) return <>—</>;

  return (
    <>
      <LocalDateTime iso={iso} seconds />
      <br />
      {hydrated ? formatRelativeTime(iso, now) : '—'}
    </>
  );
}
