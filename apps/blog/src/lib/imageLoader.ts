import type { ImageLoaderProps } from 'next/image';

const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function proxyImageLoader({
  src,
  width,
}: ImageLoaderProps): string {
  // In proxy mode, prepend the full proxy URL so the browser can reach
  // the file through the code-server prefix. assetPrefix only covers
  // _next/static chunks, not /_next/image or direct public paths.
  const base = PROXY_BASE && src.startsWith('/') ? PROXY_BASE + src : src;
  // Append width so Next.js recognises this loader as width-aware.
  // The image API ignores query params; this is purely to satisfy the framework.
  return `${base}?w=${width}`;
}
