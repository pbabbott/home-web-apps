# 2026-05-31 — PR Preview Healthz Fix

## Problem

Blog pods in PR preview namespace (`pr-104`) stuck in `CrashLoopBackOff`. Kubelet reported:

```
Readiness probe failed: HTTP probe failed with statuscode: 404
```

Probe config in `apps/blog/k8s/pr-preview/deployment.yaml` was correct (`/api/healthz`, port 3000).
Route source `src/app/api/healthz/route.ts` existed and compiled locally.

## Root Cause

`abctl docker publish` skips the build if the versioned image already exists in the registry:

```ts
const remoteImageExists = await checkRemoteImageExists(imageWithVersion);
if (remoteImageExists) {
  console.log('⚠️  Nothing to do. Skipping push. Program terminated.');
  return;
}
```

`blog:0.6.0` was pushed on 2026-05-26 — before the healthz route was committed on 2026-05-28.
Every subsequent CI run hit the skip, then ran `docker buildx imagetools create` to re-tag the stale
`blog:0.6.0` as `blog:pr-104-{sha}`. All 20+ PR tags in Harbor were identical (same image ID,
same May 27 creation timestamp). None had the healthz route.

Confirmed via:

```bash
docker run --rm harbor.../blog:pr-104-8f9dec2 find /app -name "*.js" -path "*healthz*"
# (no output)
docker inspect harbor.../blog:pr-104-1c3cc29 --format='{{.Id}}'
# sha256:16813ff0...  ← identical to pr-104-8f9dec2
```

## Fix

### `packages/abctl` — `ABCTL_IMAGE_TAG` env var override

Added `getTagOverride()` in `image-reference.ts` that reads `process.env.ABCTL_IMAGE_TAG`.
Applied to both `getImageWithVersion` (runner image) and `resolveBaseImage` (base image),
so both get the custom tag when the env var is set.

In `publish.ts`, skip the `:latest` push when `ABCTL_IMAGE_TAG` is set (no `blog:latest` for PR images).

Added unit test covering the override behavior.

### `turbo.json`

Added `ABCTL_IMAGE_TAG` to `globalPassThroughEnv` to satisfy `turbo/no-undeclared-env-vars` lint rule.

### `.github/workflows/ci.yml`

Replaced the stale `imagetools create` step with a real publish scoped to the blog:

```yaml
- name: Publish PR-specific blog image
  if: github.event_name == 'pull_request'
  run: |
    HEAD_SHA="${{ github.event.pull_request.head.sha }}"
    SHORT_SHA="${HEAD_SHA::7}"
    export ABCTL_IMAGE_TAG="pr-${{ env.PR_NUMBER }}-${SHORT_SHA}"
    pnpm turbo run docker:publish --filter=@abbottland/blog
```

Turbo dependency graph runs `docker:publish:base` first (building `blog-base:pr-{sha}`),
then `docker:publish` (building `blog:pr-{sha}` from it). Both use Docker build cache for
unchanged layers. Skip-if-exists still works: first run for a SHA builds, reruns skip cleanly.

Also changed the non-PR step from `pnpm docker:publish` → `pnpm docker:build` (versioned
images are built-only on main; PR images handle their own publish).

## Commits

- `8f46e16` feat(abctl,ci): add ABCTL_IMAGE_TAG override for PR preview builds
- `6258afd` fix(turbo): declare ABCTL_IMAGE_TAG in globalPassThroughEnv
