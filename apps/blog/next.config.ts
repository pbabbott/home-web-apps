import type { NextConfig } from 'next';

import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // Optionally, add any other Next.js config below
  transpilePackages: ['@abbottland/fui-components'],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    // Strip frontmatter from rendered content (we parse it separately with gray-matter)
    remarkPlugins: [['remark-frontmatter', { type: 'yaml', marker: '-' }]],
  },
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
