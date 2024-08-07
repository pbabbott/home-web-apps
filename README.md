# home-web-apps

This is a monorepo set up with devspaces and turbo repo to manage all of my home web applications

# What's inside?

## Apps and Packages

- `web`: a [Next.js](https://nextjs.org/) app
- `api`: an [Express](https://expressjs.com/) server
- `@repo/ui`: a React component library
- `@abbottland/logger`: Isomorphic logger (a small wrapper around console.log)
- `@abbottland/eslint-config`: ESLint presets
- `@abbottland/typescript-config`: tsconfig.json's used throughout the monorepo
- `@abbottland/jest-presets`: Jest configurations

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

# Contributing

## Install tools

### `pnpm`

https://pnpm.io/installation

```sh
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### `devspace`

https://github.com/devspace-sh/devspace

```sh
pnpm install devspace --global
```

### `turbo`

https://turbo.build/repo/docs/getting-started/installation

```sh
pnpm install turbo --global
```

## Key Commands

### Turborepo
```sh
# Local development
turbo dev

# Local build with pnpm
turbo run build
```

### devspace

develop the project in kubernetes

```sh
devspace use namespace brandon-dev
```

```sh
# remote development
devspace dev

# remote build with kaniko
devspace build 
```

```sh
 # delete everything from cluster
devspace purge
devspace cleanup local-registry
```

## VS Code Extensions

- `esbenp.prettier-vscode` - prettier

# Reference

This Turborepo has some tools setup for use:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Jest](https://jestjs.io) test runner for all things JavaScript
- [Prettier](https://prettier.io) for code formatting

## Bootstrap commands

Initial setup of turbo repo
```sh
pnpm dlx create-turbo@latest --example with-docker
```

Dev Space initialization

```sh
pnpm dlx devspace init
```