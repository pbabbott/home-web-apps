'use client';

import { createContext, useContext, useState } from 'react';

export type BlogPostStats = {
  date: string;
  readTime: string;
};

type BlogPostStatsContextValue = {
  stats: BlogPostStats | null;
  setStats: (stats: BlogPostStats | null) => void;
};

const BlogPostStatsContext = createContext<BlogPostStatsContextValue>({
  stats: null,
  setStats: () => {},
});

export function useBlogPostStats() {
  return useContext(BlogPostStatsContext);
}

/**
 * Mounted once in the root layout, above both the page tree and
 * `ReaderToolsDrawer` (which renders as the page tree's sibling, not its
 * descendant). A blog post page reports its own stats up into this
 * context on mount so the drawer — living outside that page's subtree —
 * can render them.
 */
export default function BlogPostStatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stats, setStats] = useState<BlogPostStats | null>(null);

  return (
    <BlogPostStatsContext.Provider value={{ stats, setStats }}>
      {children}
    </BlogPostStatsContext.Provider>
  );
}
