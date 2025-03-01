# Dev Guide - Publication to Docker

The purpose of this document is to explain how one can publish versioned packages to the private docker registry.

## Overview

> [!TIP]
> Make sure you're [logged into the docker registry](./dev-env-docker.md) for these steps.

### Step 1 - Issue version

This procedure is based on the `changeset` tool. Be sure to follow the steps in [Dev Guide - Publication - Versioning](./dev-guide-publication-semver.md) first.

### Step 2 - Docker Build

Be sure to run a docker build by following steps for the [Docker build process](./dev-guide-build-with-docker.md)

### Step 3 - Push all docker images to remote

This command will run `docker:push` across all packages, and will avoid overwriting any existing version in a remote repository.

```sh
pnpm docker:push
```

> [!NOTE]
> This process is highly similar to the npm process where remote versions in the artifact repository will not be overwritten.

## Setup

### 1 - Dependency on `abctl`

Be sure to list `abctl` as a `devDependency`

```json
"devDependencies": {
    "@abbottland/abctl": "workspace:*",
}
```

### 2 - Set docker:build script

Each package needing docker support should have a script named `docker:push`. This can just be a call to an `abctl` binary

```json
"scripts": {
    "docker:push": "abctl-docker-push"
}
```

### 3 - Configure `abctl`

In case you want to configure the docker build & push settings further, you can make an `abctl.yml` file to fine-tune the configuration.

For example in `apps/gluetun-sync` there exists a file `abctl.yml`

```yml
buildPreset: pnpm-turbo-docker-build
```

For more information, please see the [`abctl` README](../packages/abctl/README.md).
