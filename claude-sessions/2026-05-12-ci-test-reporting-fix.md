# 2026-05-12 — CI Test Reporting Fix

## Goal

Get `dorny/test-reporter@v2` to find JUnit XML files after `pnpm test:unit` runs in CI.

## Problem

`dorny/test-reporter@v2` always reported "No file matches path \*\*/test-results/test-results.xml".

## Root Cause Investigation

Multiple issues layered on top of each other:

1. **`EnricoMi/publish-unit-test-result-action`** — removed; requires Python/virtualenv not available on `prod-gen2-dind-runner`. Replaced with `dorny/test-reporter@v2` (JS-based).

2. **jest-junit not installed** — `packages/abctl` and `packages/logger` don't list `jest-junit` as a direct dep. pnpm strict isolation meant it wasn't in their `node_modules`. Fixed by:
   - Adding `jest-junit` to `packages/jest-presets/package.json` dependencies (direct dep)
   - Adding `jest-junit` to root `package.json` devDependencies (Node.js directory traversal fallback)
   - Adding `jest-junit: '^16.0.0'` to pnpm-workspace.yaml catalog

3. **`CI` env var not reaching jest** — `jestReporters` in `jest-presets` checks `process.env.CI` at module load time. GitHub Actions sets `CI=true` automatically, but was uncertain if turbo forwarded it. Fixed by:
   - Adding `env: CI: true` explicitly on all test run steps
   - Adding `globalPassThroughEnv: ["CI"]` to `turbo.json`

4. **Module resolution — `'jest-junit'` string** — when jest resolves reporter name `'jest-junit'` from `packages/abctl/` rootDir, it may not find it due to pnpm isolation. Fixed by:
   - Changing to `require.resolve('jest-junit')` so resolution happens from `packages/jest-presets/dist/` context (where it IS a direct dep) → returns absolute path

5. **Output path CWD-relative** — `outputDirectory: './test-results'` depends on `process.cwd()` which may differ in Docker/dind environments. Fixed by:
   - Changing to `outputDirectory: '<rootDir>/test-results'` — jest-junit uses jest's `globalConfig.rootDir` (always the package dir) as base → absolute path

6. **Turbo env filtering (suspected)** — added `globalPassThroughEnv: ["CI"]` to turbo.json to ensure CI explicitly passes through regardless of turbo's env mode.

7. **Diagnostic gap** — added `find . -name "test-results.xml"` step between test run and dorny to surface whether XML exists at all before dorny searches.

## Files Changed

| File                                        | Change                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/tests.yml`               | Removed EnricoMi action; added dorny to int/e2e jobs; added `env: CI: true` on all test steps; added diagnostic find step; fixed Playwright cache key `github.ref` → `github.ref_name` |
| `turbo.json`                                | Added `globalPassThroughEnv: ["CI"]`                                                                                                                                                   |
| `packages/jest-presets/src/jest-presets.ts` | `'jest-junit'` → `require.resolve('jest-junit')`; `'./test-results'` → `'<rootDir>/test-results'`                                                                                      |
| `packages/jest-presets/package.json`        | Added `jest-junit: "catalog:"` to dependencies                                                                                                                                         |
| `package.json` (root)                       | Added `jest-junit: "catalog:"` to devDependencies                                                                                                                                      |
| `pnpm-workspace.yaml`                       | Added `jest-junit: '^16.0.0'` to catalog                                                                                                                                               |
| `apps/pi-led-api/jest.config.ts`            | Switched from inline reporters (wrong path) to `jestReporters` from jest-presets                                                                                                       |

## Commits

```
d7b88c1 fix(ci): pass CI env through turbo and add diagnostic find step
4c257d0 fix(ci): resolve jest-junit by absolute path and use rootDir for output
f3dad26 fix(ci): explicitly set CI=true on test run steps
a0aec6e fix(ci): fix test reporting in CI
```

## Status

Still investigating. XML not being generated on CI even after all fixes. Diagnostic `find` step added to next CI run to confirm whether XML exists anywhere on filesystem. Suspected remaining cause: turbo env filtering blocking `CI` from reaching jest processes despite being set in the step env.

## Key Facts

- `jest-junit 16.0.0` requires `jest: "^27.2.3"` (peer dep), but works with jest 29 in practice
- `jestReporters` in jest-presets is a top-level const evaluated at module load time
- `globalConfig.rootDir` in jest reporters = directory containing jest.config.ts (the package dir)
- Turbo `cache: false` does NOT clean outputs before running
- pnpm `node_modules/jest-junit` at root exists (root devDep), accessible via Node.js directory traversal
- GitHub Actions automatically sets `CI=true` in runner environments
