'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import type { BlogPost, BlogCategory } from '../../../types/blog';
import type { CategoryFilter } from './CategoryList';

export type { CategoryFilter };

interface BlogPageContextValue {
  posts: BlogPost[];
  categories: string[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedCategory: CategoryFilter;
  setSelectedCategory: (cat: CategoryFilter) => void;
  heroPost: BlogPost | undefined;
  remainingPosts: BlogPost[];
  filteredPosts: BlogPost[];
  categoryCounts: Record<string, number>;
}

const BlogPageContext = createContext<BlogPageContextValue>({
  posts: [],
  categories: [],
  searchTerm: '',
  setSearchTerm: () => {},
  selectedCategory: 'All',
  setSelectedCategory: () => {},
  heroPost: undefined,
  remainingPosts: [],
  filteredPosts: [],
  categoryCounts: {},
});

export function useBlogPageContext() {
  return useContext(BlogPageContext);
}

export default function BlogPageContextProvider({
  posts,
  categories,
  children,
}: {
  posts: BlogPost[];
  categories: string[];
  children: React.ReactNode;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('All');

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        searchTerm === '' ||
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' ||
        (post.categories &&
          post.categories.includes(selectedCategory as BlogCategory));

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, posts]);

  const [heroPost, ...remainingPosts] = useMemo(() => {
    return [...filteredPosts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [filteredPosts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      if (!post.categories) continue;
      for (const cat of post.categories) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return counts;
  }, [posts]);

  return (
    <BlogPageContext.Provider
      value={{
        posts,
        categories,
        searchTerm,
        setSearchTerm,
        selectedCategory,
        setSelectedCategory,
        heroPost,
        remainingPosts,
        filteredPosts,
        categoryCounts,
      }}
    >
      {children}
    </BlogPageContext.Provider>
  );
}
