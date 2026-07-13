import { Feed } from 'feed';
import { getAllBlogPosts } from '../../lib/blog';
import { SITE_URL, SITE_NAME, AUTHOR_NAME } from '../../lib/site';

export const dynamic = 'force-static';

export function GET() {
  const posts = getAllBlogPosts();

  const feed = new Feed({
    title: SITE_NAME,
    description: 'A Blog Sharing Technical Insights on Software Engineering',
    id: SITE_URL,
    link: SITE_URL,
    language: 'en',
    favicon: `${SITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}, ${AUTHOR_NAME}`,
    updated: posts[0] ? new Date(posts[0].date) : new Date(),
    generator: SITE_NAME,
    feedLinks: {
      rss: `${SITE_URL}/feed.xml`,
    },
    author: {
      name: AUTHOR_NAME,
    },
  });

  for (const post of posts) {
    const url = `${SITE_URL}/blog/${post.slug}`;

    feed.addItem({
      title: post.title,
      id: url,
      link: url,
      description: post.seoDescription || post.excerpt,
      date: new Date(post.date),
      category: post.categories.map((name) => ({ name })),
      image: post.bannerImage
        ? `${SITE_URL}/api/blog-images/${post.slug}/${post.bannerImage}`
        : undefined,
      author: [{ name: AUTHOR_NAME }],
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
