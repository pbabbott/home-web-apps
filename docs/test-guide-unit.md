# Test Guide - Unit Tests

Unit tests verify individual functions and modules in isolation — no external services, no Docker, no network calls.

## Framework

- **Runner:** Jest via `ts-jest`
- **Preset:** `unitTestPreset` from `@abbottland/jest-presets`
- **File pattern:** `**/*.unit.test.ts`

The shared preset lives in `packages/jest-presets/src/jest-presets.ts`. Each app or package that needs unit tests imports it in `jest.config.ts`:

```ts
import { unitTestPreset, jestReporters } from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset, ...],
  reporters: jestReporters,
};
```

## Running Locally

```sh
# All packages (via turbo)
pnpm test:unit

# Single package (from that package's directory)
pnpm test:unit -- --testPathPattern="path/to/test"
```

`pnpm build` must run before unit tests because `turbo.json` lists `^build` as a dependency for the `test:unit` task.

## CI - GitHub Actions

Job: `unit-tests` in `.github/workflows/tests.yml`

Runner: `prod-gen2-dind-runner`

Steps:
1. Checkout
2. pnpm setup
3. Install and build (composite action)
4. `pnpm test:unit`
5. Publish JUnit XML results via `publish-test-results` composite action

No Docker, no secrets, no external dependencies required.

## JUnit Reporting

`jestReporters` (from `@abbottland/jest-presets`) activates `jest-junit` when `CI=true`. Output goes to `<rootDir>/test-results/test-results.xml`. The composite action `.github/actions/publish-test-results` picks this up and annotates the PR.
