/** @typedef {import('next').NextConfig} NextConfig */

/** @type {NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@abbottland/fui-components'],
};

export default nextConfig;
