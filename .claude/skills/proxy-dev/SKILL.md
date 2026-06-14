---
name: proxy-dev
description: Proxy-aware development patterns for apps/blog and apps/diagram-maker. Use when adding navigation, fetch calls, or images to either Next.js app — these break when accessing via the Coder code-server proxy without the patterns below.
allowed-tools: Read, Bash
---

Both Next.js apps run behind a code-server port proxy in the Coder dev
environment. The proxy strips its prefix before forwarding to Next.js, so
any absolute path (`/foo`) that the browser constructs loses the prefix and
hits the wrong origin. These patterns ensure everything works both through
the proxy and at plain localhost.

## When proxy is active vs. not

Both modes are controlled by a single env var in each app's `.env.local`:

| App                  | Port | `.env.local` location           |
| -------------------- | ---- | ------------------------------- |
| `apps/blog`          | 4020 | `apps/blog/.env.local`          |
| `apps/diagram-maker` | 4021 | `apps/diagram-maker/.env.local` |

Set `NEXT_PUBLIC_BASE_PATH` to the full proxy URL to enable proxy mode:

```
NEXT_PUBLIC_BASE_PATH=https://coder.local.abbottland.io/@pbabbott/home-dev.main/apps/code-server/proxy/4020
```

Leave it empty (or absent) for plain localhost — all patterns below fall back
to normal behaviour automatically when the value is empty.

## Dev server

Both app dev scripts must use `--webpack`:

```json
"dev": "next dev -p 4020 --webpack"
```

Turbopack (the Next.js 15+ default) silently ignores `assetPrefix`, so all
`_next/static/` chunks 404 through the proxy. Do not remove this flag.

## Static assets (JS / CSS)

`assetPrefix` in `next.config.mjs` handles this — already configured in both
apps. No action needed when adding new pages or components.

## Programmatic navigation — apps/blog

Use `navigate()` from `@/lib/navigate` for any `window.location` or
`router.push` call:

```ts
import { navigate } from '@/lib/navigate';

navigate('/blog/my-post'); // ✓
router.push('/blog/my-post'); // ✗ loses proxy prefix
window.location.href = '/...'; // ✗ loses proxy prefix
```

`<Link>` components do not need changes — `ProxyNavigationFixer` in the root
layout intercepts clicks automatically.

## API fetch calls — apps/diagram-maker

Use `resolveUrl()` from `@/lib/url` for any `fetch()` call with an absolute
path:

```ts
import { resolveUrl } from '@/lib/url';

fetch(resolveUrl('/api/local-diagrams')); // ✓
fetch('/api/local-diagrams'); // ✗ loses proxy prefix
```

## Images — apps/blog

Use `<Image>` from `next/image` normally. Do not add `unoptimized` — the
global custom loader in `src/lib/imageLoader.ts` handles proxy-aware src
resolution for all images.

```tsx
<Image src="/api/blog-images/slug/photo.png" alt="..." fill />           // ✓
<Image src="/api/blog-images/slug/photo.png" alt="..." fill unoptimized /> // ✗
```

## Adding a new Next.js app to the monorepo

If a new app needs proxy support, apply the same three steps:

1. Add `assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? ''` to
   `next.config.mjs`
2. Add `--webpack` to the `dev` script in `package.json`
3. Create `apps/<name>/.env.local` with `NEXT_PUBLIC_BASE_PATH=<proxy-url>`

Then add whichever of `navigate()` / `resolveUrl()` / `imageLoader` the app
needs, following the patterns above.
