const PROXY_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function navigate(path: string): void {
  window.location.href =
    PROXY_BASE && path.startsWith('/') ? PROXY_BASE + path : path;
}
