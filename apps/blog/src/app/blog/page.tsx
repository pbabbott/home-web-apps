import { getAllBlogPosts, getAllBlogCategories } from './_lib/blogPosts';
import BlogPageClient from './_components/BlogPageClient';

export default function Blog() {
  // Fetch blog posts and categories on the server side
  const posts = getAllBlogPosts();
  const categories = getAllBlogCategories();

  return <BlogPageClient posts={posts} categories={categories} />;
}
