import { useEffect, useState } from 'react';

function prefersReducedMotionNow(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tracks the `prefers-reduced-motion` media query, live. Only ever mounted
 * client-side (this app's R3F tree is dynamic-imported with `ssr: false`),
 * so the lazy initializer reading `window` is safe.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotionNow);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) =>
      setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}
