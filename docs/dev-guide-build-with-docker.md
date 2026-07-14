# Dev Guide - Build with Docker

The purpose of this document is to explain how one can run docker builds in this project.

## Overview

This project has been set up with `turborepo` so you can run `pnpm docker:build` from the root of this project and it will go into each app and package that needs building and will do so!

Alternatively, you can run `cd [project-dir]/[project-name]` and then run `pnpm docker:build` from there to just run one at-a-time.

## Setup

### 1 - Dependency on `abctl`

Be sure to list `abctl` as a `devDependency`

```json
"devDependencies": {
    "@abbottland/abctl": "workspace:*",
}
```

### 2 - Set docker:build script

Each package needing docker support should have a script named `docker:build`. This can just be a call to the `abctl` CLI

```json
"scripts": {
    "docker:build": "abctl docker build"
}
```

### 3 - Configure `abctl`

In case you want to configure the docker build settings further, you can make an `abctl.yml` file to fine-tune the configuration.

For example in `apps/gluetun-sync` there exists a file `abctl.yml`

```yml
buildPreset: pnpm-turbo-docker-build
```

For more information, please see the [`abctl` README](../packages/abctl/README.md).

## Registry & deployment

- Multi-stage builds go through `docker/pnpm-turbo.Dockerfile` (prune → install → build) as the base stage that app-specific Dockerfiles build on top of.
- Images are pushed to the local Harbor registry at `harbor.local.abbottland.io`.
- `pi-led-api` is deployed to Kubernetes via Skaffold; `blog` gets ephemeral PR-preview deployments (see `deploy-blog-preview` in `.github/CLAUDE.md`).
