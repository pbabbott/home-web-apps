'use client';
import { useEffect } from 'react';
import { navigate } from '@/lib/navigate';

const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// When accessed through a code-server port proxy the browser URL includes the
// proxy prefix, but Next.js client-side navigation strips it. This interceptor
// catches link clicks before React's handlers and redirects through the correct
// proxy URL instead.
export default function ProxyNavigationFixer() {
  useEffect(() => {
    if (!PROXY_BASE) return;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      e.preventDefault();
      e.stopPropagation();
      navigate(href);
    }

    // Capture phase runs before React's synthetic event handlers
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
