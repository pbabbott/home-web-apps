import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { BlogPost, BlogPostMetadata } from '../types/blog';

/**
 * Format reading-time minutes as "X min" (round up for partial minutes)
 */
function formatReadTime(minutes: number): string {
  const mins = Math.max(1, Math.ceil(minutes));
  return `${mins} min`;
}

/**
 * Path to the blog content directory
 */
const BLOG_CONTENT_DIR = path.join(process.cwd(), 'src/content/blog');

/**
 * Get all blog post slugs (folder names) from the content directory
 */
export function getBlogPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_CONTENT_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(BLOG_CONTENT_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      // Check if the directory contains an index.mdx file
      const mdxPath = path.join(BLOG_CONTENT_DIR, entry.name, 'index.mdx');
      return fs.existsSync(mdxPath);
    })
    .map((entry) => entry.name);
}

/**
 * Get a single blog post by slug
 * Returns null if the post doesn't exist
 */
export function getBlogPostBySlug(slug: string): BlogPost | null {
  const mdxPath = path.join(BLOG_CONTENT_DIR, slug, 'index.mdx');

  if (!fs.existsSync(mdxPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(mdxPath, 'utf8');
  const { data, content } = matter(fileContents);

  const metadata = data as BlogPostMetadata;
  const stats = readingTime(content);
  const readTime = formatReadTime(stats.minutes);

  return {
    slug,
    ...metadata,
    readTime,
  };
}

/**
 * Get raw MDX content (without frontmatter) for a blog post
 */
export function getBlogPostContent(slug: string): string | null {
  const mdxPath = path.join(BLOG_CONTENT_DIR, slug, 'index.mdx');

  if (!fs.existsSync(mdxPath)) {
    return null;
  }

  const fileContents = fs.readFileSync(mdxPath, 'utf8');
  const { content } = matter(fileContents);

  return content;
}

/**
 * Get all blog posts with their metadata
 * Sorted by date (newest first)
 * Only includes posts with status: 'published' (or no status field, for backwards compatibility)
 */
export function getAllBlogPosts(): BlogPost[] {
  const slugs = getBlogPostSlugs();

  const posts = slugs
    .map((slug) => getBlogPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null)
    .filter((post) => {
      // Only include published posts (or posts without status for backwards compatibility)
      return post.status === 'published';
    });

  // Compute series totals from all loaded posts
  const seriesCounts = new Map<string, number>();
  posts.forEach((p) => {
    if (p.series?.id) {
      seriesCounts.set(p.series.id, (seriesCounts.get(p.series.id) ?? 0) + 1);
    }
  });

  const enriched = posts.map((p) =>
    p.series
      ? { ...p, series: { ...p.series, total: seriesCounts.get(p.series.id) } }
      : p,
  );

  // Sort by date (newest first)
  return enriched.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Count published posts in a given series by id
 */
export function getSeriesTotal(seriesId: string): number {
  return getAllBlogPosts().filter((p) => p.series?.id === seriesId).length;
}

/**
 * Get all unique categories from all blog posts
 * Returns a sorted array of unique categories
 */
export function getAllBlogCategories(): string[] {
  const posts = getAllBlogPosts();
  const categorySet = new Set<string>();

  posts.forEach((post) => {
    if (post.categories && Array.isArray(post.categories)) {
      post.categories.forEach((category) => {
        categorySet.add(category);
      });
    }
  });

  return Array.from(categorySet).sort();
}
