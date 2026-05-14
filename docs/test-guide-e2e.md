# Test Guide - E2E Tests

> [!NOTE]
> E2E tests do not exist yet in this project. This document describes the intended design for when they are added.

## What E2E Tests Are

End-to-end tests verify user-facing behavior against live, deployed services — a real browser interacting with the actual production or staging URL. No mocks, no local Docker stacks.

This is different from [smoke tests](./test-guide-smoke.md), which verify that a Docker-built image boots correctly in an isolated local environment. Smoke tests check the artifact; E2E tests check the live system.

## Intended Scope

E2E tests will target publicly accessible apps in this monorepo:

- `apps/blog` — personal blog at its live URL
- `apps/diagram-maker` — diagram tool at its live URL

## Intended Design

### Framework

- **Tool:** Playwright (already used by `fui-components` for UI tests)
- **File pattern:** `**/*.e2e.spec.ts` (tentative)
- **Runner:** Playwright Test directly, not Jest

### Turbo / Scripts

When implemented, the following scripts will be added:

```json
// package.json (app level)
"test:e2e": "playwright test"

// root package.json
"test:e2e": "turbo run test:e2e"
```

### CI

A new `e2e-tests` job will be added to `.github/workflows/tests.yml`. Unlike smoke tests, it will not need Docker — it will run Playwright against the live site URL, requiring only:

- Playwright browsers installed
- The live site to be deployed and reachable from the runner

## What to Add When Implementing

1. Install Playwright in the target app: `pnpm add -D @playwright/test`
2. Create `playwright.config.ts` with `baseURL` pointing at the live site
3. Write `*.e2e.spec.ts` tests covering critical user flows
4. Add `test:e2e` script to the app's `package.json`
5. Add `test:e2e` task to `turbo.json`
6. Add `e2e-tests` job to `.github/workflows/tests.yml`
7. Update this document
