# Integration Environment - pi-led-api

The purpose of this document is to explain how the application `pi-led-api` can be developed within an integration environment.

## Overview

`pi-led-api` is an application that is meant to run on a single device. The target device is a raspberry pi 4 built with a [Pironman](https://github.com/sunfounder/pironman) case. The API controls the configuration of this case to change settings like color, the display, and other physical features of this case.

This device requirement makes its development process quite unique in this project. `skaffold` is used to live-synchronize code directly into a pod running on that specific device. This hot-reloading allows for rapid feedback and allows me to build this API against the actual device and to test the actual LED changing IRL.

## Development Procedure

Follow these steps to contribute to the `pi-led-api` application.

## Step 1 - Address dependencies

This pi-led-api relies upon a base image `harbor.local.abbottland.io/library/node-22-alpine:1.0.0`

This can be pulled from the remote registry if you are authenticated.

```sh
./scripts/docker-login.sh
```

Alternatively, this image can also be built locally here via

```sh
cd packages/node-22-alpine
pnpm docker:build
```

## Step 2 - Ensure cluster access

Next, we'll need access to the cluster

```sh
./scripts/cluster-access.sh
kubens brandon-dev
```

> [!IMPORTANT]
> Be sure to switch to the `brandon-dev` namespace.

## Step 3 - Start the app

Finally, we can start the app with `skaffold dev` (run this from the root)

## The Setup

This skaffold setup has some caveats.

### Long Build Time

The first time you run `skaffold dev` it will take quite a long time to accomplish the docker build.

Since it takes a long time, I have set `tryImportMissing: true`. This flag will pull this image from the remote container registry if it exists. While developing `.ts` files, this is totally fine, as typescript files are synchronized to the remotely running pod.

However, in the case that you need to add a package to `package.json`, then you'll notice that the tagging strategy is tied to the git commit. That means in order to get skaffold to build a new image, you'll need to issue a new commit. This seemed like a reasonable caveat to take on as the build process takes so long. That is, you can force a new build by committing changes to package.json

### Port Forwarding

This application will be available at port `4001` which will be forwarded using `kubectl`. That port is then also exposed via VS Code from the devcontainer and forwarded again back to the host machine. That means you can access routes from your host machine via `localhost:4001/` which makes for a great development experience with Postman!

## Reference

### Kaniko

I'm still not entirely sure if using a local docker build or a kaniko build is better for this use-case. For the moment, I'll keep the kaniko code here as reference in case I want to switch to it one day.

This is for the build artifact

```yaml
kaniko:
target: development
cache:
  repo: harbor.local.abbottland.io/dev/pi-led-api-cache
buildArgs:
  PROJECT_DIR: apps/
  PROJECT: pi-led-api
  BASE_IMAGE: harbor.local.abbottland.io/library/node-22-dev:1.0.0
dockerfile: ./docker/pnpm-turbo.Dockerfile
```

This is for the root config.

```yaml
cluster:
  namespace: brandon-dev
  pullSecretName: regcred
  dockerConfig:
    secretName: docker-config
```
