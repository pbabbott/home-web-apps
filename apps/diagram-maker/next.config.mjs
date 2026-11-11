/** @typedef {import('next').NextConfig} NextConfig */

/** @type {NextConfig} */
const nextConfig = {
  output: 'standalone',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  transpilePackages: [
    '@abbottland/fui-components',
    '@abbottland/next-middleware',
  ],
};

export default nextConfig;
