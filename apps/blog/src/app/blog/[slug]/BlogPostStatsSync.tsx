'use client';

import { useEffect } from 'react';
import { useBlogPostStats } from '@/context/BlogPostStats.Context';

type BlogPostStatsSyncProps = {
  date: string;
  readTime: string;
};

/**
 * Reports this post's date/readTime up into the layout-level
 * `BlogPostStats` context so `ReaderToolsDrawer` — mounted outside this
 * page's subtree — can show them. Clears on unmount so navigating away
 * (or to a non-post route) doesn't leave stale stats behind.
 */
export default function BlogPostStatsSync({
  date,
  readTime,
}: BlogPostStatsSyncProps) {
  const { setStats } = useBlogPostStats();

  useEffect(() => {
    setStats({ date, readTime });
    return () => setStats(null);
  }, [date, readTime, setStats]);

  return null;
}
