import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBlogPostBySlug, getBlogPostSlugs } from '../../../lib/blog';
import StickyHeader from '../../components/StickyHeader';
import BlogPostBannerImage from '../../components/BlogPostBannerImage';
import MDXContent from './MDXContent';
import BlogPostHeader from './BlogPostHeader';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

/**
 * Generate static params for all blog posts
 */
export async function generateStaticParams() {
  const slugs = getBlogPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post.title,
    description: post.description || post.excerpt,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description || post.excerpt,
      type: 'article',
      publishedTime: post.date,
      images: post.ogImage ? [post.ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-neutral-800 w-full min-h-screen">
      <StickyHeader />
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-24 text-neutral-100">
        <BlogPostBannerImage
          bannerImage={post.bannerImage}
          slug={slug}
          alt={post.title}
          containerClassName="w-full h-64 md:h-96 rounded-lg overflow-hidden mb-8 relative"
          imageSizes="(max-width: 768px) 100vw, 768px"
        />
        <BlogPostHeader
          title={post.title}
          date={post.date}
          readTime={post.readTime}
          categories={post.categories}
        />
        <div className="prose-headings:text-neutral-100 prose-p:text-neutral-300 prose-a:text-primary-400 prose-code:text-accent-purple-300 prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-700">
          <MDXContent slug={slug} />
        </div>
      </article>
    </div>
  );
}
