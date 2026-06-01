# Image Tag Footer — End-to-End Trace

Documents how `IMAGE_TAG` flows from source code to the live footer value.

## Footer sources

This pattern is used in two apps.

### blog

`apps/blog/src/app/(home)/FooterSection/FooterSection.tsx`

```tsx
const imageTag = process.env.IMAGE_TAG ?? 'dev';
// rendered as <Typography variant="body1">{imageTag}</Typography>
```

`apps/blog/next.config.mjs`

```js
env: {
  IMAGE_TAG: process.env.IMAGE_TAG ?? 'dev',
},
```

### diagram-maker

`apps/diagram-maker/src/app/components/DiagramEditorClient.tsx`

```tsx
// small footer bar beneath the diagram editor
<Typography variant="caption" className="text-neutral-600">
  {process.env.IMAGE_TAG ?? 'dev'}
</Typography>
```

`apps/diagram-maker/next.config.mjs`

```js
env: {
  IMAGE_TAG: process.env.IMAGE_TAG ?? 'dev',
},
```

The `env` block in `next.config.mjs` inlines `IMAGE_TAG` into the Next.js bundle at **build time** for both apps. Both pages/components are `'use client'` and statically pre-rendered (SSG) during `next build` — the version HTML is generated once and baked in. The runtime pod env var does **not** re-render the footer.

---

## Path A — CI build (authoritative)

This is the path that determines what value ends up in the shipped image.

```
set-image-tag.sh
  → IMAGE_TAG=sha-<sha7>
  → $GITHUB_ENV
    → pnpm build (next build)
      → next.config env: { IMAGE_TAG } inlines value
        → .next/server/app/index.html contains sha-<sha7>
          → artifact uploaded
```

### Step details

| Step | Where                                                                    | What happens                                                                                                |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1    | `ci.yml` `build` job                                                     | `set-image-tag.sh` runs, writes `IMAGE_TAG=sha-<sha7>` to `$GITHUB_ENV`                                     |
| 2    | `ci.yml` `build` job                                                     | `pnpm build` runs with `IMAGE_TAG` in environment                                                           |
| 3    | `apps/blog/next.config.mjs`, `apps/diagram-maker/next.config.mjs`        | `env: { IMAGE_TAG }` inlines value into each app's `next build` output                                      |
| 4    | `turbo.json` `@abbottland/blog#build`, `@abbottland/diagram-maker#build` | `"env": ["IMAGE_TAG"]` includes the value in the Turbo cache key — different SHA = cache miss = fresh build |
| 5    | `.next/server/app/index.html` (both apps)                                | Version HTML contains the baked `sha-<sha7>` value                                                          |
| 6    | `ci.yml` `build` job                                                     | `.next/**` artifacts uploaded                                                                               |

---

## Path B — Docker build (secondary)

When `abctl docker:publish` builds the `blog-base` image via `pnpm-turbo.Dockerfile`, it also runs `next build` inside Docker. Turbo remote cache (populated in Path A with the same `IMAGE_TAG`) produces a cache hit, so the identical pre-built `.next` is reused. No double-baking occurs.

```
docker-publish-sha.sh
  → ABCTL_IMAGE_TAG=sha-<sha7>
  → abctl docker:publish
    → makeBuildSettings (docker-build-settings-builder.ts)
      → buildArgs.IMAGE_TAG = sha-<sha7>   (extracted from image ref)
        → pnpm-turbo.Dockerfile
          → ARG IMAGE_TAG → ENV IMAGE_TAG=sha-<sha7>
            → turbo build (cache HIT — same key as Path A)
              → .next output reused unchanged
```

If there is no remote cache hit (e.g. fresh runner), `next build` runs with `IMAGE_TAG=sha-<sha7>` and bakes the same value.

---

## Path C — Production retag

`docker-publish.yml` triggers on push to `main`. It **does not rebuild** the image.

```
docker-retag-prod.sh
  → finds PR branch head SHA from merge commit's second parent
  → docker buildx imagetools create
      blog:sha-<sha7>  →  blog:<YYYYMMDD>-<run>-<sha7>
```

The retag copies the manifest digest with no new layers. The footer value baked into the image remains `sha-<sha7>`.

> **Implication:** The footer shows `sha-<sha7>`, not `<YYYYMMDD>-<run>-<sha7>`. If the production tag format is required in the footer, the Docker build would need to be triggered from `docker-publish.yml` rather than a retag, or the production tag would need to be injected at runtime.

---

## Path D — Kubernetes runtime (PR preview)

`deploy-preview.sh` exports `IMAGE_TAG` (extracted from the Docker image reference, e.g. `sha-<sha7>`) and substitutes it into the deployment manifest via `envsubst`:

```yaml
# apps/blog/k8s/pr-preview/deployment.yaml
env:
  - name: IMAGE_TAG
    value: '${IMAGE_TAG}'
```

This sets `IMAGE_TAG` as a Node.js process env var in the running pod. For dynamically rendered routes, Next.js would read it at request time. However, the home page is statically pre-rendered — the footer HTML was already generated during `next build`. The runtime env var has no effect on the footer.

---

## Value by environment

| Environment              | Footer shows | Set by                                            |
| ------------------------ | ------------ | ------------------------------------------------- |
| Local dev                | `dev`        | `?? 'dev'` fallback in `next.config.mjs`          |
| CI artifact / PR preview | `sha-<sha7>` | `set-image-tag.sh` → `$GITHUB_ENV` → `next build` |
| Production (retagged)    | `sha-<sha7>` | Same baked value — retag does not rebuild         |

---

## Why it showed `dev` before the fix

Applies to `blog`; same root cause would affect `diagram-maker` if it had been built before the fix.

1. `next build` in the CI `build` job ran with no `IMAGE_TAG` set → `'dev'` fallback baked in
2. Turbo remote cache stored this `dev` output
3. Docker build (`pnpm-turbo.Dockerfile`) ran `turbo build` → cache hit → reused `dev` output
4. `IMAGE_TAG` was not in `@abbottland/blog#build`'s `env` cache key → Turbo never invalidated on SHA change

---

## Files changed to fix this

| File                                                            | Change                                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/blog/next.config.mjs`                                     | Added `env: { IMAGE_TAG }` to inline at build time                                                  |
| `apps/diagram-maker/next.config.mjs`                            | Same `env: { IMAGE_TAG }` — already present                                                         |
| `apps/diagram-maker/src/app/components/DiagramEditorClient.tsx` | Added `Typography caption` footer bar beneath diagram editor showing `IMAGE_TAG`                    |
| `docker/pnpm-turbo.Dockerfile`                                  | Added `ARG IMAGE_TAG` / `ENV IMAGE_TAG` before `turbo build`                                        |
| `packages/abctl/.../docker-build-settings-builder.ts`           | Pass `IMAGE_TAG` build arg (extracted from image tag)                                               |
| `turbo.json`                                                    | Added `"env": ["IMAGE_TAG"]` to both `@abbottland/blog#build` and `@abbottland/diagram-maker#build` |
| `scripts/set-image-tag.sh`                                      | New script: computes `sha-<sha7>`, writes to `$GITHUB_ENV`                                          |
| `.github/workflows/ci.yml`                                      | Call `set-image-tag.sh` before `pnpm build` in `build` job                                          |
