# home-hud

The purpose of this document is to explain what `home-hud` is and how the application can be developed and deployed.

## Overview

`home-hud` is a Next.js dashboard for at-a-glance views into other home services. It currently has one page:

- `/tv-show-cleanup` — reads `GET /jobs` and `GET /file-renames` from `video-api` (`apps/video-api`) and renders them as tables (job status, rename suggestions) using `@abbottland/fui-components`.

## Environment Variables

| Variable                | Required for deployment?                            | Default                 | Purpose                                                                                                                                              |
| ----------------------- | --------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_API_URL`         | **Yes** — set to the deployed `video-api`'s address | `http://localhost:4002` | Server-side base URL `/tv-show-cleanup` fetches `video-api` from (`src/app/tv-show-cleanup/lib/video-api.ts`). Read at request time, not build time. |
| `IMAGE_TAG`             | No — set automatically by CI                        | `dev`                   | Baked into the build by `next.config.mjs`; shown in the page footer. See [Image Tag Footer Tracing](../../docs/image-tag-footer-tracing.md).         |
| `NEXT_PUBLIC_BASE_PATH` | No — local dev only                                 | `''`                    | Coder code-server proxy prefix. Only needed running behind that proxy locally; leave unset in every deployed environment. See `/proxy-dev`.          |

`VIDEO_API_URL` is the only variable an actual deployment needs to set — it must resolve to `video-api` from wherever `home-hud` is running (e.g. a k8s service DNS name), since the `localhost` default only works when both apps run on the same host.

## Development Procedure

### Step 1 - Start video-api

`home-hud` doesn't run `video-api` itself — start it separately (see `apps/video-api/README.md`) so `/tv-show-cleanup` has something to fetch from.

### Step 2 - Develop home-hud

```sh
pnpm dev
```

Runs on port `4022`. If `video-api` isn't on `http://localhost:4002`, set `VIDEO_API_URL` first.

### Step 3 - Lint and build

```sh
pnpm lint
pnpm build
```
