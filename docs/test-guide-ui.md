# Test Guide - UI Tests

UI tests live exclusively in `packages/fui-components` and cover the React component library. There are two distinct sub-types that run together under `pnpm test:ui`:

| Sub-type | Tool | What it tests |
|---|---|---|
| Screenshot regression | Playwright | Visual pixel diff of every Storybook story |
| DOM rendering | Vitest + `@storybook/addon-vitest` | That every story renders in a browser without throwing |

## Screenshot Regression Tests (Playwright)

### How It Works

Playwright tests (`**/*.playwright.spec.ts`) spin up Storybook on `localhost:6006` and take screenshots of each story. These screenshots are compared against baseline images committed to the repo.

Baselines live co-located with their components:

```
src/components/Button/__screenshots__/components-button--color-primary.png
```

A test fails if any pixel diff exceeds `maxDiffPixelRatio: 0.01` (1%).

### Generating Tests

Playwright spec files are **auto-generated** from Storybook — don't write them by hand. Run:

```sh
pnpm test:playwright:generate
```

This script (`scripts/generate-story-tests.ts`) connects to Storybook, enumerates all stories, and writes `*.playwright.spec.ts` files next to each component. Commit the generated files.

### Running Locally

```sh
# From packages/fui-components
pnpm test:playwright

# Update baselines after intentional visual changes
pnpm test:playwright:update-snapshots

# View the HTML report
pnpm test:playwright:report
```

Playwright config is in `packages/fui-components/playwright.config.ts`. It targets `chromium` only (Desktop Chrome) and auto-starts Storybook as a `webServer` if not already running.

## DOM Rendering Tests (Vitest)

### How It Works

Vitest runs the `storybook` project defined in `vite.config.ts`. The `@storybook/addon-vitest` plugin drives a headless Chromium browser and mounts each story. Tests pass if the story renders without throwing an error.

These tests are lighter than screenshot tests — they verify renderable correctness, not visual appearance.

### Running Locally

```sh
# From packages/fui-components
pnpm test:dom

# Watch mode during development
pnpm test:watch
```

## Running Both Together

```sh
# From packages/fui-components or repo root
pnpm test:ui
```

This runs `pnpm test:playwright && pnpm test:dom` sequentially.

## CI - GitHub Actions

Job: `ui-tests` in `.github/workflows/tests.yml`

Runner: `prod-gen2-amd64-runner` (not Docker-in-Docker; Playwright needs a real display environment)

Steps:
1. Checkout
2. pnpm setup
3. Install and build (composite action)
4. Cache Playwright browsers (keyed on `pnpm-lock.yaml`)
5. Install Playwright browsers (if cache miss)
6. Install Playwright system deps (always — OS libs not cached)
7. `pnpm test:ui`
8. Upload Playwright HTML report as an artifact
9. Publish report to GitHub Pages at `https://<org>.github.io/<repo>/reports/<run-id>/index.html`
10. Print report URL to the job summary

## JUnit Reporting

Vitest outputs a JUnit XML to `packages/fui-components/test-results/junit.xml` (configured in `vite.config.ts`). Playwright results are published as a separate HTML report artifact, not JUnit.
