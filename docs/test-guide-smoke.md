# Test Guide - Smoke Tests

Smoke tests verify that a production Docker build of an app can start and serve traffic correctly. The app runs inside Docker Compose alongside its real dependencies — no mocks, no dev-mode Node process.

This is distinct from [integration tests](./test-guide-integration.md), where the app runs as a Node process hitting Dockerized deps. Smoke tests build and run the app image itself.

## Framework

- **Runner:** Jest via `ts-jest`
- **Preset:** `smokeTestPreset` from `@abbottland/jest-presets`
- **File pattern:** `**/*.smoke.test.ts`

The shared preset lives in `packages/jest-presets/src/jest-presets.ts`. Each app imports it in `jest.config.ts`:

```ts
import { smokeTestPreset, jestReporters } from '@abbottland/jest-presets';

const config: Config = {
  projects: [..., smokeTestPreset],
  reporters: jestReporters,
};
```

## How Docker Compose Is Used

Each app that has smoke tests defines a `docker-compose.yaml` with a `smoke` profile. The app's own image is built and run alongside its real service dependencies.

### Example: `apps/gluetun-sync`

The `smoke` profile spins up three containers:

| Container | Image | Port |
|---|---|---|
| `gluetun-sync` | Built from monorepo Dockerfile | `4000` |
| `gluetun` | `qmcgaw/gluetun` (real PIA VPN) | `8000` |
| `qbittorrent` | `lscr.io/linuxserver/qbittorrent` | `8080` |

`gluetun-sync` has a `depends_on` healthcheck against both `gluetun` and `qbittorrent` before it starts.

The app image uses a Docker Compose `build` block pointing at the monorepo's shared Dockerfile (`docker/pnpm-turbo.Dockerfile`) rather than a pre-published image. This ensures tests always run against the current commit, not a stale release.

## Running Locally

```sh
# From the app directory (e.g., apps/gluetun-sync)

# 1. Build the Docker image
pnpm smoke:deps:build

# 2. Start the full stack
pnpm smoke:deps

# 3. Run tests
pnpm test:smoke

# 4. Tear down
pnpm smoke:deps:down
```

Or from the repo root (runs across all packages via turbo):

```sh
pnpm smoke:deps:build
pnpm smoke:deps
pnpm test:smoke
pnpm smoke:deps:down
```

> [!IMPORTANT]
> Smoke tests for `gluetun-sync` require `OPENVPN_USER`, `OPENVPN_PASSWORD`, and `QBITTORRENT_PASSWORD` to be set. Generate them with `pnpm env:generate` (requires 1Password CLI configured).

## CI - GitHub Actions

Job: `smoke-tests` in `.github/workflows/tests.yml`

Runner: `prod-gen2-dind-runner` (Docker-in-Docker capable)

Steps:
1. Checkout
2. pnpm setup
3. Install and build (composite action)
4. Setup test environment — 1Password connect credentials via `setup-test-env` composite action
5. `pnpm smoke:deps:build` — builds Docker images
6. `pnpm smoke:deps` — starts the stack
7. `pnpm test:smoke` (with `CI=true`)
8. Publish JUnit XML results
9. `pnpm smoke:deps:down` (always runs, even on failure)

The 1Password step injects secrets like `OPENVPN_USER` and `OPENVPN_PASSWORD` into the runner environment so Docker Compose can pass them to containers.

## JUnit Reporting

Same as unit tests — `jestReporters` activates `jest-junit` when `CI=true`. Results published via `.github/actions/publish-test-results` composite action, labeled **Smoke Tests** in the PR check.
