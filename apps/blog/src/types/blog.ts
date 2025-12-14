import type { ReactElement } from 'react';

/**
 * Blog post categories
 */
export type BlogCategory =
  | 'Web Development'
  | 'Design'
  | 'DevOps'
  | 'AI/ML'
  | 'Career';

export const categories: BlogCategory[] = [
  'Web Development',
  'Design',
  'DevOps',
  'AI/ML',
  'Career',
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
  /** Estimated reading time (e.g., "12 min") */
  readTime: string;
  /** Post category */
  category: BlogCategory;
  /** Optional gradient or image URL for the post card */
  image?: string;
  /** Whether this post should be featured */
  featured?: boolean;
  /** SEO meta description (defaults to excerpt if not provided) */
  description?: string;
  /** SEO keywords */
  keywords?: string[];
  /** Open Graph image URL */
  ogImage?: string;
}

/**
 * Blog post with slug derived from folder name
 */
export interface BlogPost extends BlogPostMetadata {
  /** Unique identifier derived from folder name */
  slug: string;
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
