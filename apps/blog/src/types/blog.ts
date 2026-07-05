import type { ReactElement } from 'react';

export type BlogPostSeries = {
  id: string;
  name: string;
  index: number;
  total?: number;
};

/**
 * Blog post categories
 */
export type BlogCategory =
  | 'Web Dev'
  | 'Design'
  | 'DevOps'
  | 'AI/ML'
  | 'Career'
  | 'Home Automation'
  | 'dns'
  | 'docker'
  | 'raspberry pi'
  | 'homelab';

export const categories: BlogCategory[] = [
  'Web Dev',
  'Design',
  'DevOps',
  'AI/ML',
  'Career',
  'Home Automation',
  'dns',
  'docker',
  'raspberry pi',
  'homelab',
];

/**
 * Frontmatter metadata for a blog post MDX file
 */
export interface BlogPostMetadata {
  /** Post title */
  title: string;
  /** Short description/excerpt of the post */
  excerpt: string;
  /** Publication date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Estimated reading time (e.g., "12 min"); derived from content if omitted */
  readTime?: string;
  /** Post categories */
  categories: BlogCategory[];
  /** Optional banner image filename (relative to blog post folder) */
  bannerImage?: string;
  /** SEO meta description (defaults to excerpt if not provided) */
  seoDescription?: string;
  /** SEO keywords */
  seoKeywords?: string[];
  /** Post status - 'published' posts are included in getAllBlogPosts(), 'draft' posts are excluded */
  status?: 'draft' | 'published';
  /** Optional series membership for grouped content */
  series?: BlogPostSeries;
}

/**
 * Blog post with slug derived from folder name.
 * readTime is always set when loaded via getBlogPostBySlug (computed from content).
 */
export interface BlogPost extends BlogPostMetadata {
  /** Unique identifier derived from folder name */
  slug: string;
  /** Estimated reading time (always set when loaded from content) */
  readTime: string;
}

/**
 * Blog post with compiled MDX content
 */
export interface BlogPostWithContent extends BlogPost {
  /** The raw MDX content (without frontmatter) */
  content: string;
  /** The compiled MDX component */
  Component: () => ReactElement;
}
