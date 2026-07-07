import type { MetadataRoute } from 'next';
import { getAllBlogPosts } from '../lib/blog';

const SITE_URL = 'https://abbottland.io';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date() },
    { url: `${SITE_URL}/blog`, lastModified: new Date() },
    { url: `${SITE_URL}/system-architecture`, lastModified: new Date() },
    { url: `${SITE_URL}/series`, lastModified: new Date() },
  ];

  const postRoutes: MetadataRoute.Sitemap = getAllBlogPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
  }));

  return [...staticRoutes, ...postRoutes];
}
