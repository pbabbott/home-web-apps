'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Re-renders the server components of the page every `intervalMs` while
 * `active` (something on the page is being worked on and changes by itself).
 */
export function useAutoRefresh(
  active: boolean,
  intervalMs: number = DEFAULT_INTERVAL_MS,
) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
}
