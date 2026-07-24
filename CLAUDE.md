# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file (and other `CLAUDE.md` files in this repo) is an index only — descriptions and links, not full content. See [Dev Guide - Documentation Conventions](./docs/dev-guide-documentation-conventions.md) for where detail belongs and how to add a new project preference.

## Repository Overview

This is a private TypeScript monorepo using **pnpm workspaces** and **Turborepo**, containing personal home web applications and shared infrastructure packages.

**Apps** (`/apps`):

- `blog` — Next.js 16 personal blog with MDX content
- `diagram-maker` — Next.js 16 diagram creation tool
- `home-hud` — Next.js 16 home dashboard/HUD app
- `gluetun-sync` — Express.js service that syncs qBitTorrent ports with Gluetun VPN
- `pi-led-api` — Express.js REST API for Raspberry Pi LED strip control
- `video-api` — Express.js API that queues video-processing jobs (Postgres-backed) for a separate video-worker

**Packages** (`/packages`):

- `fui-components` — React component library (Storybook, Vite, Playwright/Vitest). See [`packages/fui-components/CLAUDE.md`](./packages/fui-components/CLAUDE.md).
- `abctl` — oclif-based CLI for Docker builds, secrets generation, and repo tasks
- `express` — Express.js wrapper with shared middleware setup
- `yaml-config` — YAML/env config parser with TypeScript decorators
- `eslint-config` — Shared ESLint presets (`server`, `library`, `react-internal`)
- `jest-presets` — Shared Jest configuration presets
- `typescript-config` — Shared `tsconfig` presets
- `video-db` — Drizzle ORM schema, migrations, and query helpers for `video-api` (Postgres). See [Postgres & Drizzle](./docs/dev-guide-postgres-drizzle.md).

## Architecture

- **Dependencies** — which apps depend on which packages, and how shared dependency versions are managed via the pnpm catalog.
- **App patterns** — server apps (`gluetun-sync`, `pi-led-api`, `video-api`) share an Express/config/test pattern; frontend apps (`blog`, `diagram-maker`, `home-hud`) share a Next.js/Tailwind pattern; `typescript-config`/`jest-presets` provide the shared build/test presets both use.
- **Docker** — `abctl` CLI wraps Docker build/push; images publish to a local Harbor registry.
- **CI/CD** — GitHub Actions on self-hosted runners. See [`.github/CLAUDE.md`](./.github/CLAUDE.md) for the workflow list and script-integration conventions.

## Developer Guides

- [Commands](./docs/dev-guide-commands.md) - Quick `pnpm` reference for dev/build/lint/test/docker/storybook.
- [Documentation Conventions](./docs/dev-guide-documentation-conventions.md) - How `CLAUDE.md`/`docs/` fit together, and how to capture a new project preference.
- [Dependency Management](./docs/dev-guide-dependency-management.md) - When and how to use the pnpm workspace catalog.
- [Monorepo Architecture](./docs/dev-guide-monorepo-architecture.md) - Shared patterns behind the server apps, frontend apps, and config packages.
- [Postgres & Drizzle](./docs/dev-guide-postgres-drizzle.md) - How server apps that need PostgreSQL are structured (`video-api`/`video-db`).
- [Build with Docker](./docs/dev-guide-build-with-docker.md) - How to build any package with `docker`, and how images reach Harbor/Kubernetes.
- [Build with Typescript](./docs/dev-guide-build-with-typescript.md) - How to build any package with `typescript`/`turborepo`.
- [Linting](./docs/dev-guide-linting.md) - How `eslint` is set up in this repository.
- [Publication](./docs/dev-guide-publication.md) - SHA-based, CI-driven image publication: PR preview builds and production promotion.
- [Cluster Access](./docs/dev-guide-cluster-access.md) - How to pull a kubeconfig from the cluster controllers and store it in 1Password.
- [GH Actions - Secret Management](./docs/gh-action-secret-management.md) - How secrets are managed across GitHub Actions.
- [Image Tag Footer Tracing](./docs/image-tag-footer-tracing.md) - How `IMAGE_TAG` flows from source to the live footer value.
- [Blog Identity](./docs/blog-identity.md) - Analysis of published/draft posts in `apps/blog`.
- Test guides: [Unit](./docs/test-guide-unit.md) | [Integration](./docs/test-guide-integration.md) | [Smoke](./docs/test-guide-smoke.md) | [UI](./docs/test-guide-ui.md) | [E2E](./docs/test-guide-e2e.md)
