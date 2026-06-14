import type { ImageLoaderProps } from 'next/image';

const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function proxyImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (!PROXY_BASE) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
  }
  // assetPrefix only covers _next/static chunks, not /_next/image or direct paths,
  // so serve images directly through the proxy prefix instead.
  if (!src.startsWith('/')) return src;
  return PROXY_BASE + src;
}
