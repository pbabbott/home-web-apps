# Image Tag Footer — End-to-End Trace

How the running image's tag reaches the footer of `blog`, `home-hud` and `diagram-maker` (and the `/version` endpoint of the backends). The tag is read **at runtime from the pod's env**, never baked into the build.

## Why runtime, not build time

A build-time value can only be known before the image exists, but the production tag (`<YYYYMMDD>-<RUN:5>-<PR:5>-<sha7>`) is created later, on merge, by a retag that does not rebuild. A baked footer could never show it. Reading `IMAGE_TAG` from the pod also means the footer always matches what Flux deployed, and the build output is identical for every commit (so Turbo's cache hits).

## Flow

```
docker-retag-prod.sh (on merge)       sha-<sha7>  →  20261110-00091-00248-e2ba7c3
        │
Flux ImagePolicy (home-kubernetes)    selects the newest tag matching the prod shape
        │
Flux ImageUpdateAutomation            one commit sets BOTH lines in the Deployment:
        │                               image: …/blog:20261110-00091-00248-e2ba7c3   # {"$imagepolicy": "flux-system:blog"}
        │                               env IMAGE_TAG: 20261110-00091-00248-e2ba7c3  # {"$imagepolicy": "flux-system:blog:tag"}
        ▼
pod env IMAGE_TAG  →  GET /api/version (force-dynamic, no-store)  →  <BuildInfo/> footer
```

PR previews: `deploy-preview.sh` sets `IMAGE_TAG` from the image reference (`sha-<sha7>`) and `PR_NUMBER` into the preview Deployment (`apps/blog/k8s/pr-preview/deployment.yaml`).

## Pieces

| Piece                                                             | Role                                                                                                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/next-middleware` `parseImageInfo`                       | Parses the tag into `{ tag, environment, date, run, pr, sha, label }`. `prod` for a production tag, `preview` for `sha-<sha7>`, `dev` when unset.    |
| `packages/next-middleware` `versionRoute`                         | Route handler returning that info; reads `process.env['IMAGE_TAG']` per request (`Cache-Control: no-store`).                                         |
| `apps/{blog,home-hud,diagram-maker}/src/app/api/version/route.ts` | Exposes it with `export const dynamic = 'force-dynamic'` (required, or Next would prerender it at build time).                                       |
| `BuildInfo` client component in each app                          | Renders `dev` first, then fetches `/api/version` and shows `label`. Server-rendered HTML is the same for every build, so UI snapshots do not change. |
| `packages/express` `configureVersionRoute`                        | Backends: `GET /version` returns `{ tag }` and the tag is logged once at startup (`[version] image tag: …`).                                         |

## What the footer shows

| Environment | Label                                                                 |
| ----------- | --------------------------------------------------------------------- |
| prod        | `prod · 20261110-00091-00248-e2ba7c3 · 2026-11-10 · PR #248`          |
| preview     | `preview · PR #251 · sha-abc1234`                                     |
| local dev   | `dev` (also shown while loading, or if `/api/version` is unreachable) |

The date is the UTC merge date taken from the tag; there is no time of day.

## Gotchas

- Do **not** add `env: { IMAGE_TAG }` to `next.config.mjs` or rename the variable to `NEXT_PUBLIC_*`: that inlines the value at build time into server code and client bundle and the runtime read stops working.
- The route must stay `force-dynamic`, and the footer must keep rendering `dev` as its first state (UI snapshot tests run without `IMAGE_TAG`).
- Behind the Coder dev proxy the fetch uses `NEXT_PUBLIC_BASE_PATH` (`resolveUrl()` in diagram-maker); a failed fetch just leaves `dev`.
- The previous tag shape `YYYYMMDD-<run>-<sha7>` is still parsed (as `prod`, no PR) until the first new-shape release is deployed.
