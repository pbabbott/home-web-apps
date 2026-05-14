# Test Guide - Integration Tests

Integration tests verify behavior that requires real external services — databases, VPN clients, torrent clients, etc. Dependencies are not mocked.

This differs from [smoke tests](./test-guide-smoke.md): the app itself runs as a Node process (not in Docker), but its dependencies run in Docker Compose.

## Framework

- **Runner:** Jest via `ts-jest`
- **Preset:** `integrationTestPreset` from `@abbottland/jest-presets`
- **File pattern:** `**/*.integration.test.ts`

The shared preset lives in `packages/jest-presets/src/jest-presets.ts`. Each app imports it in `jest.config.ts`:

```ts
import { integrationTestPreset, jestReporters } from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    {
      ...integrationTestPreset,
      setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.ts'],
    },
    ...
  ],
  reporters: jestReporters,
};
```

## Running Locally

Start dependencies using the same command used for local development:

```sh
pnpm dev:deps
```

Then run integration tests:

```sh
pnpm test:int
```

Stop dependencies when done:

```sh
pnpm dev:deps:down
```

> [!TIP]
> `dev:deps` is intentionally not listed as a dependency in `turbo.json` because it has no output. It must be started manually before running `test:int`.

## CI - GitHub Actions

Job: `integration-tests` in `.github/workflows/tests.yml`

Runner: `prod-gen2-dind-runner` (Docker-in-Docker capable)

Steps:

1. Checkout
2. pnpm setup
3. Install and build (composite action)
4. Setup test environment — 1Password connect credentials via `setup-test-env` composite action
5. `pnpm dev:deps` — starts Docker service dependencies
6. `pnpm test:int` (with `CI=true`)
7. Publish JUnit XML results via `publish-test-results` composite action
8. `pnpm dev:deps:down` (always runs, even on failure)

## JUnit Reporting

`jestReporters` (from `@abbottland/jest-presets`) activates `jest-junit` when `CI=true`. Output goes to `<rootDir>/test-results/test-results.xml`. The composite action `.github/actions/publish-test-results` picks this up and annotates the PR.
