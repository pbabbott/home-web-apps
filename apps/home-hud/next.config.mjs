/** @typedef {import('next').NextConfig} NextConfig */

/** @type {NextConfig} */
const nextConfig = {
  output: 'standalone',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  transpilePackages: [
    '@abbottland/fui-components',
    '@abbottland/next-middleware',
  ],
  env: {
    IMAGE_TAG: process.env.IMAGE_TAG ?? 'dev',
  },
};

export default nextConfig;
