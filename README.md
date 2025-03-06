# home-web-apps

This is a monorepo set up with a devcontainer and turborepo to manage all of my home web applications

# What's inside?

All apps and packages are built with Typescript!

## Apps

- `@abbottland/gluetun-sync` - An express.js application which keeps a qBitTorrent port in sync with a dynamically assigned Gluetun vpn public port to ensure my home IP is not leaked during torrent downloads.

## Packages

- `@abbottland/eslint-config`: ESLint presets.
- `@abbottland/fui-components`: React Fantasy UI component library written with Storybook
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

- [Build with Docker](./docs/dev-guide-build-with-docker.md) - How to build any package in this project with `docker`
- [Build with Typescript](./docs/dev-guide-build-with-typescript.md) - How to build any package in this project with `typescript`
- [Linting](./docs/dev-guide-linting.md) - How linting is set up with `eslint` in this repository.
- [Publication - Semantic Versioning](./docs/dev-guide-publication-semver.md) - How to create new versions of apps and packages with `changesets`
- [Publication to Docker](./docs/dev-guide-publication-to-docker.md) - How to push new images to the remote `docker` registry.
- [Publication to NPM](./docs/dev-guide-publication-to-npm.md) - How to push new packages to the remote `npm` registry.

## Integration Environments

This section explains one can develop or test each application or package within this monorepo.

- [Integration Environment: gluetun-sync](./docs/int-env-gluetun-sync.md)
- [Integration Environment: abctl](./docs/int-env-abctl.md)

## GH Actions

- [GH Actions - Secret Management](./docs/gh-action-secret-management.md)
