/** @typedef {import('next').NextConfig} NextConfig */

/** @type {NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@abbottland/fui-components'],
  env: {
    IMAGE_TAG: process.env.IMAGE_TAG ?? 'dev',
  },
};

export default nextConfig;
