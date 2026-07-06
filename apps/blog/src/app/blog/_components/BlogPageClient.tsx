'use client';
import StickyHeader from '@/components/StickyHeader/StickyHeader';
import PageScrollLayout from '@/components/PageScrollLayout/PageScrollLayout';
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
      <div className="lg:h-dvh lg:overflow-hidden flex flex-col">
        <BlogBackground />
        <div className="z-10 relative flex-1 min-h-0 flex flex-col">
          <StickyHeader />
          <PageScrollLayout
            wrapperClassName="flex-1 min-h-0 flex flex-col lg:pr-0"
            railClassName="lg:hidden"
          >
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-4 pt-[calc(var(--header-height)+1rem)] pb-24 lg:pb-6 gap-8 lg:gap-8">
              <BlogFilters />
              <BlogFeed />
            </div>
          </PageScrollLayout>
        </div>
      </div>
    </BlogPageContextProvider>
  );
}
