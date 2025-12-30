import { getAllBlogPosts } from './blogPosts';
import BlogPageClient from './BlogPageClient';

export default function Blog() {
  // Fetch blog posts on the server side
  const posts = getAllBlogPosts();

  return <BlogPageClient posts={posts} />;
}
