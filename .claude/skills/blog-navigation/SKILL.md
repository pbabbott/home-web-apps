---
name: blog-navigation
description: Reference for the blog app's proxy-aware navigation and image patterns. Use when adding links, navigation, or images to apps/blog.
allowed-tools: Read, Bash
---

The blog app runs behind a code-server port proxy in development. The proxy
strips its prefix before forwarding to Next.js, so standard navigation APIs
lose the prefix and break. Here is how to handle navigation and images correctly.

## Navigation

**Always use `navigate()` from `@/lib/navigate` for any programmatic navigation:**

```ts
import { navigate } from '@/lib/navigate';

navigate('/blog/my-post'); // ✓
router.push('/blog/my-post'); // ✗ loses proxy prefix
window.location.href = '/blog/my-post'; // ✗ loses proxy prefix
```

`<Link>` components do not need changes — clicks are intercepted automatically
by `ProxyNavigationFixer` in the root layout (`src/app/layout.tsx`).

## Images

Use `<Image>` from `next/image` normally. Do not add the `unoptimized` prop —
the global custom loader in `src/lib/imageLoader.ts` already handles proxy-aware
src resolution for all images.

```tsx
// ✓ correct
<Image src="/api/blog-images/slug/photo.png" alt="..." fill />

// ✗ breaks image loading through proxy
<Image src="/api/blog-images/slug/photo.png" alt="..." fill unoptimized />
```

## Dev server requirement

The dev script in `package.json` must use `--webpack`:

```
"dev": "next dev -p 4020 --webpack"
```

Turbopack (the default in Next.js 15+) silently ignores `assetPrefix`, so all
`_next/static/` chunks 404 through the proxy. `--webpack` forces the webpack
dev server which respects `assetPrefix`. Do not remove this flag.

## How it works

- `NEXT_PUBLIC_BASE_PATH` in `apps/blog/.env.local` holds the full proxy URL
  (e.g. `https://coder.local.abbottland.io/@pbabbott/home-dev.main/apps/code-server/proxy/4020`)
- Next.js auto-loads `.env.local` — no custom parsing needed
- `navigate()` prepends it to any internal path starting with `/`
- `imageLoader.ts` does the same for image src URLs
- `assetPrefix` in `next.config.mjs` covers JS/CSS chunks
- When `NEXT_PUBLIC_BASE_PATH` is empty (production), all three fall back to
  normal behaviour
