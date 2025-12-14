'use client';
import { useState, useMemo } from 'react';
import { Input, Typography, Button } from '@abbottland/fui-components';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import StickyHeader from '../components/StickyHeader';
import BlogPostCard from './BlogPostCard';
import HeroBlogPostCard from './HeroBlogPostCard';
import { blogPosts, categories, type BlogCategory } from './blogPosts';

type CategoryFilter = BlogCategory | 'All';

export default function Blog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('All');

  const filteredPosts = useMemo(() => {
    return blogPosts.filter((post) => {
      const matchesSearch =
        searchTerm === '' ||
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || post.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  // Sort by date (most recent first) and split into hero and rest
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [filteredPosts]);

  const heroPost = sortedPosts[0];
  const remainingPosts = sortedPosts.slice(1);

  const allCategories: CategoryFilter[] = ['All', ...categories];

  return (
    <div className="bg-neutral-800 w-full min-h-screen">
      <StickyHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        {/* Page Title */}
        <div className="mb-12 text-center">
          <Typography
            variant="h1"
            component="h1"
            className="text-neutral-100 mb-4"
          >
            Blog
          </Typography>
          <Typography
            variant="body1"
            className="text-neutral-400 max-w-2xl mx-auto"
          >
            Topics include web development, interface design, DevOps procedures,
            and computational career trajectory analysis.
          </Typography>
        </div>

        {/* Filter Section */}
        <div className="mb-12 space-y-6">
          {/* Search Input */}
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <div className="relative flex-grow">
              <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none z-10"
                width={20}
                height={20}
              />
              <Input
                color="primary"
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchTerm(e.target.value)
                }
                className="w-full pl-10"
              />
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2">
            {allCategories.map((category) => (
              <Button
                key={category}
                color="primary"
                variant={
                  selectedCategory === category ? 'contained' : 'outlined'
                }
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'All' ? 'All Posts' : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
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
              <section>
                <Typography
                  variant="h3"
                  component="h2"
                  className="text-neutral-300 mb-8 border-l-4 border-primary-500 pl-4"
                >
                  More Posts
                </Typography>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {remainingPosts.map((post) => (
                    <BlogPostCard
                      key={post.id}
                      title={post.title}
                      excerpt={post.excerpt}
                      date={post.date}
                      readTime={post.readTime}
                      slug={post.slug}
                      category={post.category}
                      image={post.image}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
