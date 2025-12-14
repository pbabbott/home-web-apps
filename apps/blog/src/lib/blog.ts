import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogPost, BlogPostMetadata } from '../types/blog';

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
  const { data } = matter(fileContents);

  const metadata = data as BlogPostMetadata;

  return {
    slug,
    ...metadata,
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
 */
export function getAllBlogPosts(): BlogPost[] {
  const slugs = getBlogPostSlugs();

  const posts = slugs
    .map((slug) => getBlogPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null);

  // Sort by date (newest first)
  return posts.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Get featured blog posts
 */
export function getFeaturedBlogPosts(): BlogPost[] {
  return getAllBlogPosts().filter((post) => post.featured);
}
