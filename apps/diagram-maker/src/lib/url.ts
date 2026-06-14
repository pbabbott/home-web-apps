const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function resolveUrl(path: string): string {
  return PROXY_BASE && path.startsWith('/') ? PROXY_BASE + path : path;
}
