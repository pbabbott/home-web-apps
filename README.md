# home-web-apps

This is a monorepo set up with a devcontainer and turborepo to manage all of my home web applications

# What's inside?

All apps and packages are built with Typescript!

## Apps

- `@abbottland/gluetun-sync` - An express.js application which keeps a qBitTorrent port in sync with a dynamically assigned Gluetun vpn public port to ensure my home IP is not leaked during torrent downloads.
- `@abbottland/pi-led-api` - An express.js application which provides a REST API to control an LED strip inside a Raspberry Pi PIRONMAN case.
- `@abbottland/blog` - A Next.js application which serves as my personal blog.

## Packages

- `@abbottland/eslint-config`: ESLint presets.
- `@abbottland/fui-components`: React Futuristic UI component library written with Storybook
- `@abbottland/jest-presets`: Jest configurations
- `@abbottland/logger`: Placeholder code, not yet used.
- `@abbottland/typescript-config`: `tsconfig.json`'s used throughout the monorepo
- `@abbottland/yaml-config`: Custom helper library to read `yaml` files or environment variables as configuration into application memory.

# Contributing

## Configure your dev environment

- Step 1 - [Configure your Dev Environment](./docs/dev-env-main.md)
  - [Dev Environment - Cluster Access](./docs/dev-env-cluster-access.md)
  - [Dev Environment - Docker](./docs/dev-env-docker.md)
  - [Dev Environment - NPM](./docs/dev-env-npm.md)
  - [Dev Environment - 1Password](./docs/dev-env-op.md)
- Step 2 - Use VS Code to open this repository in a devcontainer

## Developer guides

- [Commands](./docs/dev-guide-commands.md) - Quick `pnpm` reference for dev/build/lint/test/docker/storybook.
- [Build with Docker](./docs/dev-guide-build-with-docker.md) - How to build any package in this project with `docker`
- [Build with Typescript](./docs/dev-guide-build-with-typescript.md) - How to build any package in this project with `typescript`
- [Linting](./docs/dev-guide-linting.md) - How linting is set up with `eslint` in this repository.
- [Publication](./docs/dev-guide-publication.md) - How PR preview images are built and published, and how merges to `main` promote them to production.
- Test guides:
  - [Unit Tests](./docs/test-guide-unit.md) - Jest unit tests, no external dependencies.
  - [Integration Tests](./docs/test-guide-integration.md) - Node process hitting Dockerized real dependencies.
  - [Smoke Tests](./docs/test-guide-smoke.md) - Docker-built app image running against real dependencies.
  - [UI Tests](./docs/test-guide-ui.md) - Playwright screenshot regression and Vitest DOM tests for `fui-components`.
  - [E2E Tests](./docs/test-guide-e2e.md) - Live site browser tests (not yet implemented).

## Development Environments

Each application or package in this monorepo may have unique requirements for development and testing. Below are the specific guides for setting up and working with different development environments:

- [packages/abctl](./docs/dev-env-abctl.md)
- [apps/gluetun-sync](./apps/gluetun-sync/README.md)
- [apps/pi-led-api](./docs/dev-env-pi-led-api.md)

## GH Actions

- [GH Actions - Secret Management](./docs/gh-action-secret-management.md)
