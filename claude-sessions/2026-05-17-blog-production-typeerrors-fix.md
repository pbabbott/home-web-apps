# 2026-05-17 — Blog Production TypeErrors Fix

## Goal

Investigate `TypeError: Cannot read properties of undefined (reading 'x')` and `TypeError: Cannot read properties of undefined (reading 'b')` appearing in `apps/blog` container logs at `https://abbottland.io`.

## Investigation Path

### Initial log analysis (`blog-runtime.log`)

- Two server-side TypeErrors with digests `2175976232` and `1959713192`
- "ignore-listed frames" hid the full stack (production minification)
- No environment variables used anywhere in the blog source — ruled out missing `NEXT_PUBLIC_*` vars

### Confirmed same image in prod

- `kubectl get pod` showed `harbor.local.abbottland.io/library/blog:0.2.4`
- Pod image SHA matched the pulled image: `sha256:c784db48df58c3fae3249fd6fc7483a7bb6fc886a21d60a6fff903ec91a40315`
- Cluster uses HTTPRoute (Gateway API via Istio), not Ingress

### Port-forward test confirmed errors are non-fatal

- `kubectl port-forward` + curl → HTTP 200, page renders fine
- Errors already existed in pod logs from startup (first request triggers them, then cached pages serve cleanly)
- Blog was actually working — errors were the only concern

## Root Cause

**`fui-components` dist built with `NODE_ENV=development`** → Vite emitted `jsxDEV` from `react/jsx-dev-runtime` instead of `jsx`/`jsxs` from `react/jsx-runtime`.

In production SSR, `react/jsx-dev-runtime`'s `jsxDEV` has different internal behavior — accesses on undefined internals produced the `.x` and `.b` TypeErrors.

Discovery method: rebuilt `fui-components` with `NODE_ENV=production`, rebuilt blog, ran standalone server locally — TypeErrors gone.

## Fix

**`packages/fui-components/package.json`** — locked `build:npm` to always use production mode:

```diff
- "build:npm": "tsc -b && vite build",
+ "build:npm": "NODE_ENV=production tsc -b && NODE_ENV=production vite build",
```

## Side Finding

Build fails when `NODE_ENV=development` (ambient shell) during `next build` — the `/_global-error` and `/(home)/page` prerender steps break with `useContext(null)`. Always run `NODE_ENV=production pnpm --filter @abbottland/blog build`.

## Files Changed

- `packages/fui-components/package.json` — `build:npm` script hardened
