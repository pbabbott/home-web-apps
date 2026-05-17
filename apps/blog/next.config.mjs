/** @typedef {import('next').NextConfig} NextConfig */

import createMDX from '@next/mdx';

/** @type {NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // Optionally, add any other Next.js config below
  transpilePackages: ['@abbottland/fui-components', '@xyflow/react'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Allow unoptimized images from API routes
    unoptimized: false,
  },
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    // Strip frontmatter from rendered content (we parse it separately with gray-matter)
    remarkPlugins: [['remark-frontmatter', { type: 'yaml', marker: '-' }]],

    // Use string reference for rehype-pretty-code to ensure serializable options for Turbopack
    rehypePlugins: [['rehype-pretty-code', { theme: 'material-theme-darker' }]],
  },
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
