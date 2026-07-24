# Scripts

Every script must be locally runnable, not just callable from CI.

## Manifest

Keep this table up to date: any script added, removed, or repurposed — or whose CI usage changes — must have its row added/removed/updated in the same change.

| Script                         | What it does                                                                                                                                    | CI usage                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-changeset.sh`           | Fails if `apps/` or `packages/` changed since the base ref without a new `.changeset/*.md` file added alongside.                                | Documented in `.github/CLAUDE.md` as the script-extraction example, but not currently wired into a workflow.                                                                                                                                                       |
| `check-remote-image.sh`        | Checks whether a given `IMAGE` tag exists in Harbor and prints `true`/`false`.                                                                  | Gates `deploy-blog-preview` so it skips the deploy (instead of failing) when blog's PR image wasn't published this run.                                                                                                                                            |
| `cluster-access.sh`            | Fetches the admin kubeconfig from 1Password and switches `kubectl`/`kubens` to the `brandon-dev` namespace.                                     | Not used in CI — local developer convenience script only.                                                                                                                                                                                                          |
| `deploy-preview.sh`            | Deploys blog for a PR into an ephemeral `pr-<N>` Kubernetes namespace and waits for rollout + DNS.                                              | Run by `deploy-blog-preview` once `docker-build` has published the PR's blog image, giving the PR a live preview URL.                                                                                                                                              |
| `docker-login.sh`              | Logs the Docker CLI into Harbor using credentials fetched from 1Password.                                                                       | Run before any job that pushes or pulls Harbor images (`docker-build`, `docker-publish`, `playwright-runner-publish`, `security-scan`).                                                                                                                            |
| `docker-publish-plan.sh`       | Prints a JSON array of package names that have a `docker:publish` task and changed relative to a base ref (via turbo's change filter, dry-run). | Run by `docker-build-plan` to compute the `docker-build` matrix, so each changed package gets its own runner pod.                                                                                                                                                  |
| `docker-publish-sha.sh`        | Publishes `sha-<sha7>`-tagged images to Harbor, either for one `PACKAGE` or (if unset) every package changed relative to a base ref.            | Run by `docker-build`'s matrix (one `PACKAGE` per job) to publish the image `docker-publish-plan.sh` picked for that runner.                                                                                                                                       |
| `docker-retag-prod.sh`         | Retags each app's already-published `sha-<sha7>` image with a dated production tag, without rebuilding.                                         | Run by the `docker-publish` workflow on every push to `main` to promote a PR's images to production.                                                                                                                                                               |
| `get-kube-config-file.sh`      | Pulls kubeconfigs from each cluster controller over SCP, prefixes names to avoid collisions, and flattens them into one config.                 | Not used in CI — local developer cluster-access setup only.                                                                                                                                                                                                        |
| `integration-test-plan.sh`     | Prints a JSON array of package names that have a `test:int` task (via turbo dry-run, no change filter).                                         | Run by `integration-test-plan` to compute the `integration-tests` matrix, so each package's tests (and any docker-compose dev deps) get their own runner pod instead of racing each other for host ports.                                                          |
| `security-scan-pull-images.sh` | Pulls the Harbor image for blog/diagram-maker/fui-components (this commit's tag if published, else the most recent one) locally.                | Run by `security-scan` right after `docker-build` to gather the images Trivy will scan.                                                                                                                                                                            |
| `security-scan-report.sh`      | Scans the locally-tagged blog/diagram-maker/fui-components images with Trivy and writes a combined Markdown report plus a per-target JUnit XML. | Run by `security-scan` after the pull step; the JUnit output is published as a GitHub Check via `dorny/test-reporter`, the Markdown is posted to the job summary and uploaded as an artifact, and its exit code gates the check on fixable CRITICAL/HIGH findings. |
| `set-image-tag.sh`             | Computes the dated `IMAGE_TAG` (`<YYYYMMDD>-<run>-<sha7>`) and writes it to `$GITHUB_ENV`.                                                      | Run by `build` before `pnpm build` so the tag baked into the app matches what `docker-build` later pushes.                                                                                                                                                         |
| `setup-n8n-mcp.sh`             | Registers the `n8n-mcp` MCP server with `claude mcp add`, fetching the n8n API key from 1Password.                                              | Not used in CI — local developer convenience script only.                                                                                                                                                                                                          |
| `teardown-preview.sh`          | Deletes the `pr-<N>` Kubernetes namespace and its resources.                                                                                    | Run by `pr-teardown.yml`'s `teardown-preview` job whenever a PR is closed.                                                                                                                                                                                         |
| `turbo-auth.sh`                | Exports `TURBO_TOKEN`/`TURBO_API`/`TURBO_TEAM` (fetching the token from 1Password if not pod-injected) for turbo's remote cache.                | Sourced by the `lint` and `build` jobs before running turbo commands so they hit the shared remote cache.                                                                                                                                                          |
| `unit-test-plan.sh`            | Prints a JSON array of package names that have a `test:unit` task (via turbo dry-run, no change filter).                                        | Run by `unit-test-plan` to compute the `unit-tests` matrix, so each package's unit tests get their own runner pod instead of piling onto one shared pod.                                                                                                           |

## Authoring conventions

- Shebang: `#!/usr/bin/env bash` (not `/bin/bash`)
- `set -euo pipefail` near the top
- `cd "$(dirname "$0")/.."` so relative paths resolve from the repo root
- `# Local usage:` comment block at the top — show the minimal invocation and any required env vars
- Inputs via env vars with sensible defaults: `VAR="${VAR:-default}"`

`deploy-preview.sh` is the canonical example.

## Secrets

Scripts fetch all credentials from 1Password directly — they are never injected as individual secrets from CI. The only input from CI is `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN`, which the script uses to authenticate the `op` CLI.

`docker-login.sh` is the canonical example: it fetches Harbor credentials internally via `op item get`, and falls back gracefully when credentials are provided directly (for local overrides or testing).

## Local invocation

```bash
bash ./scripts/script-name.sh
VAR=value bash ./scripts/script-name.sh
```

## CI integration

See `.github/CLAUDE.md` — CI steps call scripts and pass vars via `env:`.
