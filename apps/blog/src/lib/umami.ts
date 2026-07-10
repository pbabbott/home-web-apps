type UmamiWindow = typeof window & {
  umami?: {
    track: (eventName: string, data?: Record<string, unknown>) => void;
  };
};

export function trackEvent(eventName: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  (window as UmamiWindow).umami?.track(eventName, data);
}
