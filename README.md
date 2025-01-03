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
- Step 2 - Use VS Code to open this repository in a devcontainer

## Developer guides

- [Build with Docker](./docs/dev-guide-build-with-docker.md) - How to build any package in this project with `docker`
- [Build with Typescript](./docs/dev-guide-build-with-typescript.md) - How to build any package in this project with `typescript`
- [Linting](./docs/dev-guide-linting.md) - How does linting work in this repository?