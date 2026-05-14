'use client';

import { useEffect, useState, type ComponentType } from 'react';

type MDXContentProps = {
  slug: string;
};

export default function MDXContent({ slug }: MDXContentProps) {
  const [Content, setContent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    import(`../../../content/blog/${slug}/index.mdx`)
      .then((module) => {
        setContent(() => module.default);
      })
      .catch((err) => {
        setError(err);
      });
  }, [slug]);

  if (error) {
    return <div>Error loading content: {error.message}</div>;
  }

  if (!Content) {
    return <div>Loading...</div>;
  }

  return <Content />;
}
