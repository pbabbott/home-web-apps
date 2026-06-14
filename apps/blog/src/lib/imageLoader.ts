import type { ImageLoaderProps } from 'next/image';

const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function proxyImageLoader({ src }: ImageLoaderProps): string {
  // In proxy mode, prepend the full proxy URL so the browser can reach
  // the file through the code-server prefix. assetPrefix only covers
  // _next/static chunks, not /_next/image or direct public paths.
  if (PROXY_BASE && src.startsWith('/')) return PROXY_BASE + src;
  // In localhost mode, return the src directly. /_next/image does not
  // support SVG without dangerouslyAllowSVG, so bypass it entirely.
  return src;
}
