# 2026-05-13 — UI Tests CI Fix

## Branch
`new-comp-lib`

## Problem
`ui-tests` CI job failing on PR #85. 8 Playwright visual regression tests failing with `toHaveScreenshot` mismatches — exactly 1 pixel different per test.

Failing tests:
- `Button Visual Regression Tests > color-primary`
- `Button Visual Regression Tests > variant-contained`
- `Input Visual Regression Tests > primary-with-value`
- `TransparentPanel Visual Regression Tests > dark`
- `TransparentPanel Visual Regression Tests > primary`
- `TransparentPanel Visual Regression Tests > secondary`
- `ButtonShowcase Visual Regression Tests > colors-and-variants`
- `TransparentPanelShowcase Visual Regression Tests > all-colors`

## Root Cause
Screenshot baselines committed in repo were generated on a different rendering environment than the CI Linux runner. The `snapshotPathTemplate` in `playwright.config.ts` has no `{platform}` token, so all platforms share a single baseline file. 1-pixel anti-aliasing difference between local snapshot generation environment and CI Chromium rendering.

## What We Did
- Read `ui-tests.log` from CI to identify failures
- Confirmed all failures were `toHaveScreenshot` mismatches (not logic failures)
- Inspected `playwright.config.ts` — no `maxDiffPixels` tolerance set, custom `snapshotPathTemplate` without platform token
- Ran `pnpm run test:playwright:update-snapshots` in the dev container (Linux) to regenerate baselines
  - Result: 70 tests passed (no diffs found locally), 3 Badge tests crashed with `page.goto: Page crashed` (unrelated, Badge not in CI failures)
  - **No snapshot files changed** — local container renders identically to existing baselines

## Status: UNRESOLVED
The local devcontainer renders the same as existing snapshots but CI still produces 1-pixel diffs. This means the CI self-hosted runner's Chromium version or font rendering differs from this container AND from wherever the original snapshots were captured.

## Next Steps
Two options:
1. **Add pixel tolerance** — `maxDiffPixels: 2` in `playwright.config.ts` `expect` block. Catches real regressions, tolerates sub-pixel diffs.
2. **Investigate CI Chromium version** — compare Playwright/Chromium version on CI runner vs local to find exact divergence, then align environments.

Option 1 is fastest. Option 2 is correct if we want to understand why identical-OS environments differ.
