# home-hud

The purpose of this document is to explain what `home-hud` is and how the application can be developed and deployed.

## Overview

`home-hud` is a Next.js dashboard for at-a-glance views into other home services.

## Environment Variables

| Variable                | Required for deployment?     | Default | Purpose                                                                                                                                      |
| ----------------------- | ---------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `IMAGE_TAG`             | No — set automatically by CI | `dev`   | Baked into the build by `next.config.mjs`; shown in the page footer. See [Image Tag Footer Tracing](../../docs/image-tag-footer-tracing.md). |
| `NEXT_PUBLIC_BASE_PATH` | No — local dev only          | `''`    | Coder code-server proxy prefix. Only needed running behind that proxy locally; leave unset in every deployed environment. See `/proxy-dev`.  |

## Development Procedure

### Step 1 - Develop home-hud

```sh
pnpm dev
```

Runs on port `4022`.

### Step 2 - Lint and build

```sh
pnpm lint
pnpm build
```

<!-- ci: trigger docker build -->
