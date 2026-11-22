'use client';

import { useSyncExternalStore } from 'react';
import { formatDate } from './budget-display';

const subscribe = () => () => {};

/**
 * Renders a timestamp in the viewer's local timezone. Server render and
 * hydration use UTC (so they match); the browser's timezone applies after.
 */
export function LocalDate({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatDate(iso, isClient)}
    </time>
  );
}
