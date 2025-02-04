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

## Setup

Each package should have a script named `docker:push` and it should call a shell script located in `scripts/docker-push.sh`

Abstract example:

```json
"docker:push": "../../scripts/docker-push.sh [project-dir] [project-name]",
```

Tangible example:

```json
// Notice the empty space between "apps/" and "gluetun-sync"
"docker:push": "../../scripts/docker-push.sh apps/ gluetun-sync",
```

> [!NOTE]
> This process is highly similar to the npm process where remote versions in the artifact repository will not be overwritten.
