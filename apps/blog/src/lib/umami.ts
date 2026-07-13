import { usePathname } from 'next/navigation';

type UmamiWindow = typeof window & {
  umami?: {
    track: (eventName: string, data?: Record<string, unknown>) => void;
  };
};

export function trackEvent(eventName: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  (window as UmamiWindow).umami?.track(eventName, data);
}

/**
 * Like trackEvent, but automatically includes the current pathname as
 * `page` on every event.
 */
export function useTrackEvent() {
  const pathname = usePathname();
  return (eventName: string, data?: Record<string, unknown>) =>
    trackEvent(eventName, { page: pathname, ...data });
}
