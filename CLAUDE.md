# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a private TypeScript monorepo using **pnpm workspaces** and **Turborepo**, containing personal home web applications and shared infrastructure packages.

**Apps** (`/apps`):

- `blog` — Next.js 16 personal blog with MDX content
- `diagram-maker` — Next.js 16 diagram creation tool
- `gluetun-sync` — Express.js service that syncs qBitTorrent ports with Gluetun VPN
- `pi-led-api` — Express.js REST API for Raspberry Pi LED strip control

**Packages** (`/packages`):

- `fui-components` — React component library (Storybook, Vite, Playwright/Vitest)
- `abctl` — oclif-based CLI for Docker builds, secrets generation, and repo tasks
- `express` — Express.js wrapper with shared middleware setup
- `yaml-config` — YAML/env config parser with TypeScript decorators
- `eslint-config` — Shared ESLint presets (`server`, `library`, `react-internal`)
- `jest-presets` — Shared Jest configuration presets
- `typescript-config` — Shared `tsconfig` presets

## Commands

All commands are run from the repo root unless otherwise noted.

### Development

```bash
pnpm dev          # Start all dev servers
pnpm dev:ui       # Start only blog, fui-components, diagram-maker
pnpm dev:deps     # Start Docker dependencies (dev services)
pnpm dev:deps:down
```

### Build

```bash
pnpm build        # Build all packages
pnpm clean        # Remove all dist directories
```

### Lint & Format

```bash
pnpm lint         # ESLint + tsc type-check across all projects
pnpm lint:fix
pnpm format:check # Prettier check
pnpm format:fix
```

### Tests

```bash
pnpm test:unit    # Jest unit tests (all packages)
pnpm test:int     # Jest integration tests (requires Docker)
pnpm test:e2e     # Jest e2e tests (requires Docker e2e stack)
pnpm test:ui      # Playwright + Vitest tests for fui-components only
```

To run a single test file from a package directory:

```bash
# From the specific package directory
pnpm test:unit -- --testPathPattern="path/to/test"
```

### Secrets & Environment

```bash
pnpm env:generate  # Generate .env files from 1Password (requires OP CLI configured)
```

### Storybook

```bash
pnpm storybook     # Start Storybook dev server (port 6006)
```

## Architecture

### Dependency Flow

Apps consume shared packages:

- `blog` and `diagram-maker` depend on `fui-components`
- `gluetun-sync` and `pi-led-api` depend on `express`, `yaml-config`, and `abctl`
- `fui-components` uses `abctl` for Docker/publishing tasks

### Server Apps (`gluetun-sync`, `pi-led-api`)

Follow a consistent pattern:

- `@abbottland/express` wraps Express with shared middleware
- `@abbottland/yaml-config` provides config via decorators + YAML/env files
- `sample.env` documents required environment variables
- Docker Compose for local dev dependencies; `abctl` for Docker builds and publishing
- Jest projects config with separate `unit`, `int`, and `e2e` suites

### Frontend Apps (`blog`, `diagram-maker`)

- Next.js 16 with `@mdx-js/loader` for content
- TailwindCSS 4 with PostCSS
- Import `fui-components` as a workspace package

### Component Library (`fui-components`)

- Built as a library with **Vite** (`build:npm`) and exported as ESM/CJS
- **Storybook 10** for development and documentation
- **Playwright** for screenshot regression tests; **Vitest** for DOM unit tests
- Test stories are auto-generated via `test:playwright:generate`

### TypeScript Configs

Presets in `packages/typescript-config/`:

- `ts-base.json` — ESNext, CommonJS, decorators enabled
- `ts-server-build.json` — for Express apps (extends base, emits to `dist/`)
- `ts-lib-base.json` — for packages
- `react-library.json` — for React component packages

### Test Presets

`packages/jest-presets` exports `unitTestPreset`, `integrationTestPreset`, `e2eTestPreset`, and `jestReporters`. Apps import these in `jest.config.ts` and use Jest `projects` to run multiple suites.

### Docker

- Multi-stage builds via `docker/pnpm-turbo.Dockerfile` (prune → install → build)
- Images pushed to local Harbor registry at `local.abbottland.io`
- `pi-led-api` is deployed to Kubernetes via Skaffold
- `abctl` CLI (`pnpm docker:build` / `pnpm docker:publish`) wraps Docker build/push

### CI/CD

GitHub Actions workflows (`.github/workflows/`) run on PRs with self-hosted runners:

- `build.yml` — installs and builds
- `lint.yml` — ESLint and Prettier checks
- `tests.yml` — four parallel jobs: `unit-tests`, `integration-tests`, `e2e-tests`, `ui-tests`

Composite actions in `.github/actions/` handle pnpm setup, install+build, and test environment setup (1Password + Docker Buildx).
