# CI / Scripts

## Workflows

`.github/workflows/`:

- `ci.yml` — runs on PRs to `main`: lint, format, build, docker-build (publishes `sha-<sha7>` images), UI/unit/integration/smoke tests, `security-scan` (Trivy), then `deploy-blog-preview`
- `docker-publish.yml` — runs on push to `main`: retags each app's `sha-<sha7>` image with a dated production tag (no rebuild)
- `pr-teardown.yml` — runs on PR close: deletes the PR's preview namespace
- `playwright-runner-publish.yml` — publishes the shared Playwright test-runner Docker image

Composite actions in `.github/actions/`: `pnpm-setup`, `publish-test-results`, `setup-test-env` (1Password + Docker Buildx).

## Secrets

Workflows pass exactly one user-managed secret: the 1Password Connect token (`OP_CONNECT_TOKEN_PROD`). All other credentials (Docker, kubeconfig, API keys, etc.) are fetched inside scripts via the 1Password CLI. The only acceptable exception is `secrets.GITHUB_TOKEN`, which is GitHub's built-in ephemeral token and cannot be stored in 1Password.

```yaml
- name: Docker Login
  run: bash ./scripts/docker-login.sh
  env:
    OP_CONNECT_HOST: https://op-connect.local.abbottland.io
    OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN_PROD }}
```

Never add a new `secrets.<NAME>` reference for a credential that can be fetched from 1Password.

## Extracting logic to scripts

Non-trivial multi-step logic belongs in `./scripts/`, not inlined in workflow YAML steps. A step should be one line:

```yaml
- name: Check for changeset
  run: bash ./scripts/check-changeset.sh
  env:
    BASE_REF: ${{ github.base_ref }}
```

Pass all variables explicitly via an `env:` block — never rely on ambient environment state.

Scripts must be locally runnable. See `scripts/CLAUDE.md` for authoring conventions.

Any workflow step added, removed, or changed to call a script in `./scripts/` must have a matching update to the manifest table in `scripts/CLAUDE.md`.
