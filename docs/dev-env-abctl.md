# Development Environment - abctl

The purpose of this document is to explain how the package `abctl` can be developed within an Development environment.

## Overview

The `abctl` package is short for `Abbottland` + `control`. The idea is that the `abctl` package exports a few binaries to help with common activities needed in this repository. While the `scripts/` directory does exist for quick one-off activities, some actions are more complex and require proper management over the logic and control flow of the action. In these cases, `abctl` is here to help!

## Development Procedure

### Step 1 - Start `abctl` in dev mode

First, navigate to `packages/abctl` then run `pnpm dev`

This will enable rapid development on the `abctl` package.

### Step 2 - Check configuration of a dependent package

`abctl` is meant to be run in a package or an app directory, and it must be listed in the `devDependencies`.

For example, take a look at `apps/gluetun-sync/package.json`. In the `package.json` file...

```json
  "scripts": {
    "docker:build": "abctl-docker-build",
    "docker:push": "abctl-docker-push"
  },
  "devDependencies": {
    "@abbottland/abctl": "workspace:*"
  },
```

And notice this file: `apps/gluetun-sync/abctl.yml`

```yml
buildPreset: pnpm-turbo-docker-build
```

### Step 3 - Make changes and execute

From the upstream dependency's directory (eg `apps/gluetun-sync`) you can now run commands like `pnpm docker:build`.

If things aren't quite right, make changes to code in `packages/abctl` and then run commands in the upstream once again.

### Step 4 - Celebrate

You now know how to effectively make changes to `abctl` and how to test these changes in upstream dependencies across this monorepo. This process will work for any app or package that relies upon `abctl` like `packages/node-22-alpine`, or `apps/pi-led-api` and more!

## Testing Procedure

### Unit tests

Unit tests have been set up for `abctl`.

These are easy to run:

```sh
cd packages/abctl
pnpm test:unit
```
