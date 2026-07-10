import { getAllBlogPosts, getAllBlogCategories } from './_lib/blogPosts';
import { structuredDataService } from '../../lib/StructuredDataService';
import JsonLd from '@/components/JsonLd/JsonLd';
import BlogPageClient from './_components/BlogPageClient';

export default function Blog() {
  // Fetch blog posts and categories on the server side
  const posts = getAllBlogPosts();
  const categories = getAllBlogCategories();

  return (
    <>
      <JsonLd data={structuredDataService.getBlogListingJsonLd(posts)} />
      <BlogPageClient posts={posts} categories={categories} />
    </>
  );
}
