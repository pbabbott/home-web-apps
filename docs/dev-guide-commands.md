# Dev Guide - Commands

Quick reference for the root-level `pnpm` scripts used day to day. All commands run from the repo root unless noted otherwise.

## Development

```bash
pnpm dev          # Start all dev servers
pnpm dev:ui       # Start only blog, fui-components, diagram-maker
pnpm dev:deps     # Start Docker dependencies (dev services)
pnpm dev:deps:down
```

## Build

```bash
pnpm build        # Build all packages
pnpm clean        # Remove all dist directories
```

See [Dev Guide - Build with Typescript](./dev-guide-build-with-typescript.md) and [Dev Guide - Build with Docker](./dev-guide-build-with-docker.md).

## Lint & Format

```bash
pnpm lint         # ESLint + tsc type-check across all projects
pnpm lint:fix
pnpm format:check # Prettier check
pnpm format:fix
```

See [Dev Guide - Linting](./dev-guide-linting.md).

## Tests

```bash
pnpm test:unit    # Jest unit tests (all packages)
pnpm test:int     # Jest integration tests (requires Docker)
pnpm test:smoke   # Jest smoke tests (requires Docker smoke stack)
```

Run UI tests per package (no root-level command):

```bash
# From packages/fui-components
pnpm test:ui      # Playwright + Vitest tests

# From apps/blog
pnpm test:ui      # Playwright screenshot tests
```

To run a single test file from a package directory:

```bash
# From the specific package directory
pnpm test:unit -- --testPathPattern="path/to/test"
```

See test guides: [Unit](./test-guide-unit.md) | [Integration](./test-guide-integration.md) | [Smoke](./test-guide-smoke.md) | [UI](./test-guide-ui.md) | [E2E](./test-guide-e2e.md)

## Secrets & Environment

```bash
pnpm env:generate  # Generate .env files from 1Password (requires OP CLI configured)
```

## Storybook

```bash
pnpm storybook     # Start Storybook dev server (port 6006)
```
