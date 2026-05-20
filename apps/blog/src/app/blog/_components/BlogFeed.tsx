'use client';
import { Typography } from '@abbottland/fui-components';
import BlogPostCard from './BlogPostCard';
import HeroBlogPostCard from './HeroBlogPostCard';
import { useBlogPageContext } from './Blog.Context';

export default function BlogFeed() {
  const { filteredPosts, heroPost, remainingPosts } = useBlogPageContext();

  return (
    <main className="flex-1 min-w-0">
      <div className="mb-12">
        <Typography
          variant="h1"
          component="h1"
          className="text-neutral-100 mb-4"
        >
          Blog
        </Typography>
        <Typography variant="body1" className="text-neutral-400 max-w-2xl">
          Topics include web development, interface design, DevOps procedures,
          and computational career trajectory analysis.
        </Typography>
      </div>

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
          {heroPost && (
            <section className="mb-16">
              <HeroBlogPostCard post={heroPost} />
            </section>
          )}

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
  );
}
