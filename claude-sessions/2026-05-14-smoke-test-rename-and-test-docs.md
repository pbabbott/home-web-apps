# Session: Smoke Test Rename + Test Documentation

**Date:** 2026-05-14
**Branch:** `new-comp-lib`

## What We Did

### 1. Investigated gluetun-sync e2e tests

Explored what the e2e tests actually hit in CI:

- Only test file: `tests/e2e/health.e2e.test.ts` — hits `http://localhost:4000/healthz`
- Full docker-compose stack spins up: `gluetun-sync`, `gluetun` (real PIA VPN), `qbittorrent`
- GH Actions job builds the Docker image first, then starts the stack, then runs the health check

### 2. Renamed e2e test tier → smoke

Rationale: the existing "e2e" tests verify a prod Docker build boots (smoke), not end-to-end user flows. Renamed to reserve "e2e" for future live-site Playwright tests.

Files changed:

- `packages/jest-presets/src/jest-presets.ts` — `e2eTestPreset` → `smokeTestPreset`, file glob `*.e2e.test.ts` → `*.smoke.test.ts`
- `apps/gluetun-sync/jest.config.ts` — updated import and project list
- `apps/gluetun-sync/package.json` — `e2e:deps*` → `smoke:deps*`, `test:e2e` → `test:smoke`, docker-compose profile arg `e2e` → `smoke`
- `apps/gluetun-sync/docker-compose.yaml` — profile name + image tag `gluetun-sync:e2e` → `gluetun-sync:smoke`
- `apps/gluetun-sync/tests/e2e/health.e2e.test.ts` → `tests/smoke/health.smoke.test.ts`
- `package.json` (root) — scripts renamed
- `turbo.json` — pipeline task keys renamed
- `.github/workflows/tests.yml` — job `e2e-tests` → `smoke-tests`, all step names and script calls updated
- `CLAUDE.md` — updated 4 references

### 3. Created per-type test guide docs

New files in `docs/`:

- `test-guide-unit.md` — Jest + `unitTestPreset`, no deps, turbo build dep, CI job
- `test-guide-integration.md` — Jest + `integrationTestPreset`, `pnpm dev:deps`, why `dev:deps` not in turbo, CI job
- `test-guide-smoke.md` — Docker-built image + compose `smoke` profile, real VPN deps, 1Password secrets, CI job
- `test-guide-ui.md` — Playwright screenshot regression + Vitest/Storybook DOM, auto-generation script, GH Pages report, CI runner differences
- `test-guide-e2e.md` — Not yet implemented; design doc for future live-site Playwright tests

### 4. Removed dev-guide-test-automation.md

Verified all content (unit, integration, smoke) was covered in new guides before deleting. Fixed stale link in `test-guide-smoke.md`.

Updated links in:

- `README.md` — replaced single "Test Automation" link with nested list of all 5 guides
- `CLAUDE.md` — added inline guide links after test command block

## Commit

```
d2abaf2 refactor(test): rename e2e test tier to smoke
```
