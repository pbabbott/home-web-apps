# 2026-06-01 — Blog Footer IMAGE_TAG Fix

## Problem

Footer of the live blog always showed `dev` instead of the deployed image tag. Pod was running `blog:20260601-21-dc38225` but footer read `dev`.

## Root Cause Chain

1. Home page is `'use client'` — `process.env` vars in client bundles must be inlined at build time, not read at runtime
2. `next.config.mjs` had no `env` config, so `IMAGE_TAG` was never inlined
3. CI `build` job ran `pnpm build` without `IMAGE_TAG` set → `'dev'` fallback baked in
4. `IMAGE_TAG` was not in Turbo's cache key for `@abbottland/blog#build` → stale `dev` output reused across builds
5. `docker-build-settings-builder.ts` didn't pass `IMAGE_TAG` as a Docker build arg

## Fix (multiple PRs, all on `develop` → PR #107)

### Tag format

Changed from `sha-<sha7>` to `<YYYYMMDD>-<RRR>-<sha7>` (run number zero-padded to 3 digits, e.g. `20260601-021-dc38225`). This matches the production retag format and is human-readable.

### Files changed

| File | Change |
|---|---|
| `apps/blog/next.config.mjs` | Added `env: { IMAGE_TAG }` to inline at build time |
| `docker/pnpm-turbo.Dockerfile` | Added `ARG IMAGE_TAG` / `ENV IMAGE_TAG` before `turbo build` |
| `packages/abctl/.../docker-build-settings-builder.ts` | Prefer `process.env.IMAGE_TAG` over image ref tag extraction |
| `packages/abctl/.../docker-build-settings-builder.unit.test.ts` | Updated tests for new behavior + added env override test case |
| `turbo.json` | Added `"env": ["IMAGE_TAG"]` to `@abbottland/blog#build`; added `IMAGE_TAG` to `globalPassThroughEnv` |
| `scripts/set-image-tag.sh` | New script: computes `YYYYMMDD-RRR-sha7`, writes to `$GITHUB_ENV` |
| `scripts/docker-publish-sha.sh` | Accepts `RUN_NUMBER`, exports both `ABCTL_IMAGE_TAG=sha-<sha7>` and `IMAGE_TAG=YYYYMMDD-RRR-sha7` |
| `.github/workflows/ci.yml` | Calls `set-image-tag.sh` before `pnpm build`; passes `RUN_NUMBER` to both scripts |
| `docs/image-tag-footer-tracing.md` | New doc tracing full IMAGE_TAG flow end-to-end |

### Key insight: Turbo cache

`IMAGE_TAG` must be in `@abbottland/blog#build`'s `env` array so changing the SHA produces a cache miss. Without this, Turbo reuses the `dev`-baked `.next` output indefinitely.

### Key insight: Docker build path

In `docker-publish-sha.sh`, `IMAGE_TAG` is exported before `pnpm turbo run docker:publish`. `docker-build-settings-builder.ts` reads `process.env.IMAGE_TAG` and passes it as a Docker build arg. Turbo then hits the remote cache (same `IMAGE_TAG` as the CI `build` job) — no double bake.

### Production behavior

`docker-retag-prod.sh` retags `sha-<sha7>` → `YYYYMMDD-PRODRUN-sha7` without rebuilding. Footer keeps the CI-baked value (`YYYYMMDD-CIRUN-sha7`). Accepted trade-off — shows the build identity, not the exact prod tag.

## Branch / PR

- Branch: `develop`
- PR: #107 (`develop` → `main`)
- Also merged `feat/harbor-cleanup` (PR #106) into `main` during this session; resolved merge conflicts into `develop`
