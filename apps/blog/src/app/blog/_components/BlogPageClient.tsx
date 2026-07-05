'use client';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import BlogBackground from './BlogBackground';
import BlogFilters from './BlogFilters';
import BlogFeed from './BlogFeed';
import BlogPageContextProvider from './Blog.Context';
import type { BlogPost } from '../../../types/blog';

interface BlogPageClientProps {
  posts: BlogPost[];
  categories: string[];
}

export default function BlogPageClient({
  posts,
  categories,
}: BlogPageClientProps) {
  return (
    <BlogPageContextProvider posts={posts} categories={categories}>
      <div>
        <BlogBackground />
        <div className="z-10 relative">
          <StickyHeader />
          <div className="flex flex-col lg:flex-row max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-4 pt-[calc(var(--header-height)+1rem)] pb-24 gap-8 lg:gap-8">
            <BlogFilters />
            <BlogFeed />
          </div>
        </div>
      </div>
    </BlogPageContextProvider>
  );
}
