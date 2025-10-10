# Dev Guide - Test Automation

The purpose of this document is to explain how the `unit`, `integration`, and `e2e` tests are set up to run automatically in this project.

## Overview

Test automation is set up in the following workflow file:

`.github/workflows/tests.yml`

## Unit Tests

Unit tests are easy to run! They do not have any dependencies on any other services and can effectively be run after a few commands:

```sh
pnpm install
pnpm build
pnpm test:unit
```

The root of this project is also set up to run unit test across all packages and apps with `pnpm test:unit` using `turbo` to run all tests.

The dependency on `pnpm build` is set up via `turbo.json`

## Integration Tests

Integration tests in this project are defined as any test that requires another service to be running (ie. dependent services should not be mocked as in unit tests).

In order to start these dependent services just run the same command that you would to start dependencies for developing the service itself:

```sh
pnpm dev:deps
```

Once the dependent services are up, then you can run integration tests with ease:

```sh
pnpm test:int
```

> [!TIP]
> Since `dev:deps` does not have any output, I've decided to not list it as a dependency in `turbo.json`

## e2e tests

The e2e test are very similar to the integration tests. Dependencies should be started with this command:

```sh
pnpm e2e:deps
```

This will actually start the service in question with docker via docker compose. In fact, the docker compose files typically have a `profile` set to `e2e` so that the service will not start during development.

With the full stack running, now you can run e2e tests against the actual service running in an isolated environment:

```sh
pnpm test:e2e
```
