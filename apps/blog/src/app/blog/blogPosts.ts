// Re-export types and utilities from the centralized blog module
export type { BlogPost, BlogCategory } from '../../types/blog';
export { categories } from '../../types/blog';
export { getAllBlogPosts, getAllBlogCategories } from '../../lib/blog';
