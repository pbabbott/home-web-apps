'use client';

import { useSyncExternalStore } from 'react';
import { formatLocalDateTime } from './job-display';

const subscribeNever = () => () => {};

/** False during SSR and hydration, true afterwards, so local-zone text never mismatches server markup. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

interface LocalDateTimeProps {
  iso: string | null;
  seconds?: boolean;
  dateOnly?: boolean;
}

/** An ISO timestamp in the viewer's local zone; `—` until hydrated. */
export function LocalDateTime({ iso, seconds, dateOnly }: LocalDateTimeProps) {
  const hydrated = useHydrated();

  return (
    <>{hydrated ? formatLocalDateTime(iso, { seconds, dateOnly }) : '—'}</>
  );
}
