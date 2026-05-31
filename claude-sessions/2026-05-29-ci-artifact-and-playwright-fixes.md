# CI Artifact and Playwright Fixes

**Date:** 2026-05-29
**Branch:** `feature/pr-preview-environments`

## Summary

Diagnosed and fixed two compounding CI reliability issues: unreliable node_modules artifact sharing across jobs, and a Playwright chromium install step that hung indefinitely (58+ minutes) after completing its download.

## Problem 1: node_modules Artifact Unreliable

**Symptom:** `prettier: not found` in the `format` job despite `deps` artifact being downloaded. Jobs depending on the artifact had broken symlinks or missing binaries at runtime.

**Root cause:** pnpm uses hardlinks + symlinks. Uploading `node_modules` as a tar artifact and re-extracting it on a fresh runner breaks the content-addressable store references. The extracted symlinks pointed nowhere valid.

**Fix:**

- Removed the `install` job and `deps` artifact entirely
- Added pnpm store cache to `pnpm-setup` composite action, keyed on `pnpm-lock.yaml` hash, path `/home/runner/.local/share/pnpm/store`
- Each job now independently runs `pnpm install --frozen-lockfile` after `pnpm-setup`
- With a warm store, install is symlink-only — typically under 10 seconds

**Files changed:**

- `.github/actions/pnpm-setup/action.yaml` — added `Cache pnpm store` step
- `.github/workflows/ci.yml` — removed `install` job, removed all `deps` artifact upload/download steps, added `pnpm install --frozen-lockfile` to every job

## Problem 2: Playwright Chromium Install Hangs

**Symptom:** `Install Playwright chromium` step ran for 58+ minutes after completing the 164.7 MiB download at 100%. Job never finished.

**Root cause (initial):** Workflow used `restore-keys` on the playwright browsers cache. A partial cache hit (different lockfile hash) restored stale chromium files into `playwright-browsers/`. `cache-hit` output is `false` on partial match, so the install step ran, trying to extract new chromium over existing stale files — causing a hang.

**Secondary issue:** Uploading 164MB chromium as an artifact on every run (including cache hits) was extremely slow and itself could cause the `playwright-setup` job to hang during upload.

**Fixes applied in sequence:**

1. Removed dedicated `playwright-setup` job entirely — no more artifact upload for browsers
2. Moved cache + conditional install inline into each UI test job
3. Changed cache path from workspace-relative `playwright-browsers/` to `~/.cache/ms-playwright` (Playwright's own default, self-managed directory)
4. Removed `restore-keys` — exact-key-only hits, no partial restores, no stale file conflicts
5. Removed `PLAYWRIGHT_BROWSERS_PATH` env var — Playwright uses its default location

**Diagnostics added (still in place for next run):**

- `Pre-install diagnostics` step: prints disk space, memory, CPU, existing cache size
- Background monitor during install: prints free disk + free mem every 30s
- `DEBUG=pw:install*` env var for verbose Playwright install logs
- `timeout-minutes: 5` on the install step so it fails fast instead of hanging 58min

## Other Changes

- `integration-tests` and `smoke-tests` now `needs: [build, docker-build]` — ensures Docker images are published before integration/smoke test runs

## Commits This Session

- `4258e3e` — ci: replace node_modules artifact with pnpm store cache
- `942c9e9` — ci: remove playwright-setup job, cache browsers per UI test job
- `718054d` — ci: gate integration and smoke tests on docker-build
- `02887e8` — ci: fix playwright install hang — use default cache path, no restore-keys
- `66c31d4` — ci: add diagnostics and timeout to playwright chromium install

## Open Issue

The `pnpm-setup/action.yaml` pnpm store cache step keeps getting silently dropped by something (linter or IDE). As of end of session it's not committed — needs to be re-added and committed once the culprit is identified.
