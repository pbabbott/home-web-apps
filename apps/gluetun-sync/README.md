# gluetun-sync

The purpose of this document is to explain what is `gluetun-sync` and how the application can be developed and tested.

- [gluetun-sync](#gluetun-sync)
  - [Overview](#overview)
  - [Development Procedure](#development-procedure)
    - [Step 1 - Generate a .env file](#step-1---generate-a-env-file)
    - [Step 2 - Start dependencies](#step-2---start-dependencies)
    - [Step 4 - Develop gluetun-sync](#step-4---develop-gluetun-sync)
    - [Step 5 - Run unit and integration tests](#step-5---run-unit-and-integration-tests)
  - [e2e Testing Procedure](#e2e-testing-procedure)
    - [Step 1 - Start e2e dependencies](#step-1---start-e2e-dependencies)
    - [Step 2 - Run e2e tests](#step-2---run-e2e-tests)
    - [Step 3 - Teardown](#step-3---teardown)

## Overview

The gluetun sync application is an Express.js API that is meant to connect two services in sync: `qbittorrent` and `gluetun`. `gluetun` is a vpn client and `qbittorrent` is a torrent client. In order for these two work together successfully, the port that gluetun is assigned when connecting to PIA needs to be set in qbittorrent. Ocassionally, this port will change and so a CRON routine has also been established to keep this port in sync across services. A few API routes also exist to check on the status of the last sync, the current ports, and another exists to manually get things back-in-sync.

## Development Procedure

The gluetun-sync application requires two services to be running so that it may be developed: `qbittorrent` and `gluetun`. The `gluetun-sync` app is meant to facilitate communication among these two services, so it follows that having these services running will enable a robust development or test environment.

### Step 1 - Generate a .env file

The first step is to set all necessary environment variables. This process has been scripted out thanks to the 1Password connect-server integration. Start by running this command to generate the `.env` file

```sh
pnpm env:generate
```

> [!IMPORTANT]
> In order for this command to work `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` must be defined. For local development, these are set up as a part of the `.devcontainer` configuration.

### Step 2 - Start dependencies

The next step is to start any dependencies the application needs

```sh
pnpm dev:deps
```

> [!NOTE]
> To stop dependencies, simply run `pnpm dev:deps:down`

### Step 4 - Develop gluetun-sync

Next, simply start the app in development mode.

```sh
pnpm dev
```

### Step 5 - Run unit and integration tests

You can also run unit tests and integration tests while having the dev dependencies up-and-running.

Run unit tests:

```sh
pnpm test:unit
```

Run integration tests:

```sh
pnpm test:int
```

## e2e Testing Procedure

e2e tests are also set up for `gluetun-sync`! The setup is slightly different for these. The intention of these e2e tests is to build and run the app with docker so that it is highly similar to the remote environment in k8s. Against this locally running docker stack, we run e2e to ensure the service can actually start and function as expected.

### Step 1 - Start e2e dependencies

Use this command to start dependencies for the e2e tests to run properly.

```sh
pnpm e2e:deps
```

> [!NOTE]
> This will perform a docker build via the `docker-compose.yml` file instead of the normal `pnpm docker:build`. This is because the multi-platform build process is a bit slow and its nice to have e2e run against the specific commit in CI and not whatever the most recent release is.

### Step 2 - Run e2e tests

With the docker compose stack up and running, now you can easily run e2e tests with

```sh
pnpm test:e2e
```

### Step 3 - Teardown

Shut down the stack with this command:

```sh
pnpm e2e:deps:down
```
