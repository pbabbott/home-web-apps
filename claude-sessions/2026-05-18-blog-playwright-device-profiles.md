# 2026-05-18 — Blog Playwright Device Profile Cleanup

## What changed

Refactored `apps/blog/playwright.config.ts` Playwright project definitions for correctness and clarity.

### Project renames

- `macbook_air` → `desktop`
- `tablet` → `galaxy-tab-s7plus`

### Device base fixes

- `s26ultra`: `Desktop Chrome` → `Galaxy S24` — gains `isMobile: true`, `hasTouch: true`, `dpr: 2.75`
- `galaxy-tab-s7plus`: `Desktop Chrome` → `Galaxy Tab S7` — gains `isMobile: true`, `hasTouch: true`, `dpr: 2.25`
- `desktop`: kept `Desktop Chrome` (correct)

**Why this mattered:** `Desktop Chrome` base sets `isMobile: false` and `hasTouch: false`, so CSS `@media (hover: hover)` and `@media (pointer: fine)` would incorrectly apply desktop hover styles in "mobile" screenshots.

### User agent cleanup

Removed all hardcoded `userAgent` strings — each project now inherits UA from its Playwright device preset.

### Snapshot updates

All stale snapshots deleted and regenerated under new project names:

- `*-macbook-air.png` → `*-desktop.png`
- `*-tablet.png` → `*-galaxy-tab-s7plus.png`
- `*-s26ultra.png` regenerated (device base changed)

## Commit

`ecd5519` — `test(blog): update Playwright project names and device profiles`
