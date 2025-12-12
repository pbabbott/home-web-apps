import {
  accentPurple,
  accentFalcon,
  primary,
  secondary,
  warning,
  error,
  gradient,
} from '@abbottland/fui-components';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: BlogCategory;
  image?: string;
  featured?: boolean;
}

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

export const blogPosts: BlogPost[] = [
  {
    id: '1',
    slug: 'building-scalable-react-applications',
    title: 'Building Scalable React Applications with Modern Patterns',
    excerpt:
      'Explore advanced architectural patterns for building React applications that scale gracefully. From compound components to state machines, learn the techniques that top teams use to manage complexity.',
    date: '2025-12-10',
    readTime: '12 min',
    category: 'Web Development',
    image: gradient(accentPurple[400], accentPurple[600]),
    featured: true,
  },
  {
    id: '2',
    slug: 'design-systems-from-scratch',
    title: 'Creating a Design System from Scratch',
    excerpt:
      'A comprehensive guide to building a cohesive design system that bridges the gap between designers and developers. Learn about tokens, components, and documentation strategies.',
    date: '2025-12-05',
    readTime: '15 min',
    category: 'Design',
    image: gradient(accentFalcon[400], error.DEFAULT),
  },
  {
    id: '3',
    slug: 'kubernetes-for-developers',
    title: "Kubernetes Demystified: A Developer's Guide",
    excerpt:
      'Cut through the complexity of Kubernetes. This practical guide covers everything you need to know to deploy and manage containerized applications effectively.',
    date: '2025-11-28',
    readTime: '18 min',
    category: 'DevOps',
    image: gradient(secondary.DEFAULT, primary[700]),
  },
  {
    id: '4',
    slug: 'llm-powered-applications',
    title: 'Building LLM-Powered Applications in 2025',
    excerpt:
      'Discover best practices for integrating large language models into your applications. From prompt engineering to RAG systems, learn how to build intelligent features.',
    date: '2025-11-20',
    readTime: '14 min',
    category: 'AI/ML',
    image: gradient(primary[200], accentFalcon[100]),
  },
  {
    id: '5',
    slug: 'navigating-tech-career-growth',
    title: 'Navigating Your Tech Career: From Junior to Staff Engineer',
    excerpt:
      'A roadmap for career progression in software engineering. Learn what it takes to level up, the skills that matter most, and how to demonstrate impact at each stage.',
    date: '2025-11-15',
    readTime: '10 min',
    category: 'Career',
    image: gradient(warning[50], warning.DEFAULT),
  },
  {
    id: '6',
    slug: 'typescript-advanced-patterns',
    title: 'Advanced TypeScript Patterns You Should Know',
    excerpt:
      'Level up your TypeScript skills with advanced type manipulation, conditional types, and inference patterns. Write safer, more expressive code with these techniques.',
    date: '2025-11-08',
    readTime: '16 min',
    category: 'Web Development',
    image: gradient(primary[500], accentPurple.DEFAULT),
  },
  {
    id: '7',
    slug: 'ci-cd-pipelines-best-practices',
    title: 'CI/CD Pipelines: Best Practices for 2025',
    excerpt:
      'Optimize your deployment workflows with modern CI/CD strategies. Learn about trunk-based development, feature flags, and progressive delivery techniques.',
    date: '2025-11-01',
    readTime: '11 min',
    category: 'DevOps',
    image: gradient(error.DEFAULT, warning[200]),
  },
  {
    id: '8',
    slug: 'motion-design-for-developers',
    title: 'Motion Design Principles for Frontend Developers',
    excerpt:
      'Bring your interfaces to life with purposeful animation. Learn the principles of motion design and how to implement smooth, meaningful transitions in your apps.',
    date: '2025-10-25',
    readTime: '9 min',
    category: 'Design',
    image: gradient(accentPurple[200], accentFalcon[200]),
  },
];
