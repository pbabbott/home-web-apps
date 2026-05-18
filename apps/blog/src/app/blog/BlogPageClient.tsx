'use client';
import { useState, useMemo } from 'react';
import {
  Input,
  Typography,
  DotGridBackground,
} from '@abbottland/fui-components';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import StickyHeader from '../components/StickyHeader';
import BlogPostCard from './BlogPostCard';
import HeroBlogPostCard from './HeroBlogPostCard';
import CategoryList, { type CategoryFilter } from './CategoryList';
import type { BlogPost, BlogCategory } from '../../types/blog';

interface BlogPageClientProps {
  posts: BlogPost[];
  categories: string[];
}

export default function BlogPageClient({
  posts,
  categories,
}: BlogPageClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('All');

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        searchTerm === '' ||
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' ||
        (post.categories &&
          post.categories.includes(selectedCategory as BlogCategory));

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, posts]);

  // Sort by date (most recent first) and split into hero and rest
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [filteredPosts]);

  const heroPost = sortedPosts[0];
  const remainingPosts = sortedPosts.slice(1);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      if (!post.categories) continue;
      for (const cat of post.categories) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  return (
    <div className="relative bg-neutral-800 w-full min-h-screen">
      <DotGridBackground color="default" />
      <div className="relative z-10">
        <StickyHeader />
        <div className="flex flex-col lg:flex-row max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-24 gap-8 lg:gap-12">
          {/* Left sidebar: filters (~15–20% on large screens, sticky) */}
          <aside className="w-full lg:w-[18%] lg:min-w-[200px] lg:max-w-[280px] lg:shrink-0">
            <div className="sticky top-28 space-y-6">
              <Typography
                variant="subtitle1"
                className="text-neutral-400 font-medium uppercase tracking-wider"
              >
                Filters
              </Typography>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none z-10"
                  width={18}
                  height={18}
                />
                <Input
                  color="primary"
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchTerm(e.target.value)
                  }
                  className="w-full pl-9"
                />
              </div>

              {/* Category list (vertical, scrollable if many) */}
              <CategoryList
                categories={categories}
                categoryCounts={categoryCounts}
                totalCount={posts.length}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </aside>

          {/* Right: main content (remaining space) */}
          <main className="flex-1 min-w-0">
            {/* Page Title */}
            <div className="mb-12">
              <Typography
                variant="h1"
                component="h1"
                className="text-neutral-100 mb-4"
              >
                Blog
              </Typography>
              <Typography
                variant="body1"
                className="text-neutral-400 max-w-2xl"
              >
                Topics include web development, interface design, DevOps
                procedures, and computational career trajectory analysis.
              </Typography>
            </div>

            {/* Content */}
            {filteredPosts.length === 0 ? (
              <div className="py-16">
                <Typography variant="h3" className="text-neutral-400 mb-4">
                  No posts found
                </Typography>
                <Typography variant="body2" className="text-neutral-500">
                  Try adjusting your search or filter criteria.
                </Typography>
              </div>
            ) : (
              <>
                {/* Hero Section */}
                {heroPost && (
                  <section className="mb-16">
                    <HeroBlogPostCard post={heroPost} />
                  </section>
                )}

                {/* Blog Posts Grid */}
                {remainingPosts.length > 0 && (
                  <section id="more-posts">
                    <Typography
                      variant="h3"
                      component="h2"
                      className="text-neutral-300 mb-8 border-l-4 border-primary-500 pl-4"
                    >
                      More Posts
                    </Typography>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {remainingPosts.map((post) => (
                        <BlogPostCard
                          key={post.slug}
                          title={post.title}
                          excerpt={post.excerpt}
                          date={post.date}
                          readTime={post.readTime}
                          slug={post.slug}
                          categories={post.categories}
                          bannerImage={post.bannerImage}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
