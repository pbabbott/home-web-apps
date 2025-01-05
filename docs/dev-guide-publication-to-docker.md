# Dev Guide - Publication to Docker

The purpose of this document is to explain how one can publish versioned packages to the private docker registry.

## Overview

> [!TIP]
> Make sure you're [logged into the docker registry](./dev-env-docker.md) for these steps.

### Step 1 - Issue version

This procedure is based on the `changeset` tool. Be sure to follow the steps in  [Dev Guide - Publication - Versioning](./dev-guide-publication-semver.md) first.

###  Step 2 - Build

Be sure to run a docker build by following steps for the [Docker build process](./dev-guide-build-with-docker.md)

###  Step 2 - Publish

Be sure to run a build so that various `dist/` directories are up-to-date.

### Step N - Push all docker images to remote

This command will run `docker:push` across all packages, and will avoid overwriting any existing version in a remote repository.

```sh
pnpm docker:push
```