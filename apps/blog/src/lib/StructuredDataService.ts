import type { BlogPost } from '../types/blog';
import { SITE_URL, SITE_NAME, AUTHOR_NAME } from './site';

interface ImageObjectJsonLd {
  '@type': 'ImageObject';
  url: string;
}

interface PersonJsonLd {
  '@type': 'Person';
  name: string;
}

interface OrganizationJsonLd {
  '@type': 'Organization';
  name: string;
  url: string;
}

interface BlogPostingCore {
  '@type': 'BlogPosting';
  headline: string;
  url: string;
  datePublished: string;
  author: PersonJsonLd;
}

export interface BlogPostingJsonLd extends BlogPostingCore {
  '@context': 'https://schema.org';
  description: string;
  dateModified: string;
  keywords?: string;
  image?: ImageObjectJsonLd;
  publisher: OrganizationJsonLd;
  mainEntityOfPage: { '@type': 'WebPage'; '@id': string };
}

export interface BlogListingJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Blog';
  name: string;
  url: string;
  blogPost: BlogPostingCore[];
}

/**
 * Builds schema.org JSON-LD payloads for the blog listing page and
 * individual article pages from the same frontmatter-derived BlogPost data,
 * so both pages stay in sync with a single source of truth. The listing
 * page's `blogPost` entries reuse the same core fields (headline, url,
 * datePublished, author) as the full article-page BlogPosting, rather than
 * being derived independently.
 */
export class StructuredDataService {
  constructor(private readonly siteUrl: string = SITE_URL) {}

  private postUrl(slug: string): string {
    return `${this.siteUrl}/blog/${slug}`;
  }

  private postImage(post: BlogPost): ImageObjectJsonLd | undefined {
    if (!post.bannerImage) return undefined;
    return {
      '@type': 'ImageObject',
      url: `${this.siteUrl}/api/blog-images/${post.slug}/${post.bannerImage}`,
    };
  }

  private buildPostingCore(post: BlogPost): BlogPostingCore {
    return {
      '@type': 'BlogPosting',
      headline: post.title,
      url: this.postUrl(post.slug),
      datePublished: post.date,
      author: { '@type': 'Person', name: AUTHOR_NAME },
    };
  }

  getArticleJsonLd(post: BlogPost): BlogPostingJsonLd {
    const core = this.buildPostingCore(post);

    return {
      '@context': 'https://schema.org',
      ...core,
      description: post.seoDescription || post.excerpt,
      dateModified: post.date,
      keywords: post.seoKeywords?.join(', '),
      image: this.postImage(post),
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: this.siteUrl,
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': core.url },
    };
  }

  getBlogListingJsonLd(posts: BlogPost[]): BlogListingJsonLd {
    return {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} Blog`,
      url: `${this.siteUrl}/blog`,
      blogPost: posts.map((post) => this.buildPostingCore(post)),
    };
  }
}

export const structuredDataService = new StructuredDataService();
