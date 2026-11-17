'use client';

import { useState, useSyncExternalStore } from 'react';
import { LocalDateTime } from '../../exodus/lib/LocalDateTime';
import { formatRelativeTime } from '../../exodus/lib/job-display';

const subscribeNever = () => () => {};

interface TimeValueProps {
  iso: string | undefined;
}

/** A timestamp in the viewer's zone with a relative line beneath; `—` when missing, and until hydrated so SSR markup matches. */
export function TimeValue({ iso }: TimeValueProps) {
  // Keyed on the timestamp so "now" is re-read only when the data was refreshed
  // (a router.refresh() after a sync), not on a tick.
  return <TimeValueInner key={iso ?? ''} iso={iso} />;
}

function TimeValueInner({ iso }: TimeValueProps) {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const [now] = useState(() => Date.now());

  if (!iso) return <>—</>;

  return (
    <>
      <LocalDateTime iso={iso} seconds />
      <br />
      {hydrated ? formatRelativeTime(iso, now) : '—'}
    </>
  );
}
