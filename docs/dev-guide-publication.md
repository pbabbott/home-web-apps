# Dev Guide - Publication

This project uses a **SHA-based, CI-driven** image publication strategy. There are no semantic version bumps or changeset files. Every commit produces an immutable image tag; production promotion is a retag operation, not a rebuild.

## Tag types

| Tag            | Format                    | When created                     | Purpose                                  |
| -------------- | ------------------------- | -------------------------------- | ---------------------------------------- |
| SHA tag        | `sha-<sha7>`              | Every PR CI run                  | Canonical, immutable artifact identifier |
| Production tag | `<YYYYMMDD>-<run>-<sha7>` | Main branch workflow after merge | Marks a commit as promoted to production |

## Lifecycle

### 1 — Open a pull request

When CI runs on a PR, the `docker-build` job:

1. Runs `docker system prune -f` to free runner disk space.
2. Calls `pnpm turbo run docker:publish --filter='./apps/*'`, which builds and pushes each app image tagged `sha-<sha7>`.

The SHA used is always `github.event.pull_request.head.sha` — the exact commit on the PR branch, not the hypothetical merge commit.

### 2 — Deploy preview environment

After all CI jobs pass, the `deploy-blog-preview` job deploys the PR to a preview namespace in the cluster. The image used is `harbor.local.abbottland.io/library/blog:sha-<sha7>`, computed from the PR head SHA. If that tag wasn't published (blog unchanged in this PR), the job checks first and skips the deploy instead of failing. The preview URL is `https://pr-<N>-blog.local.abbottland.io`.

See [`scripts/deploy-preview.sh`](../scripts/deploy-preview.sh) for the full deployment logic.

### 3 — Merge to main

The `docker-publish.yml` workflow triggers on merge. It does **not** rebuild the image. Instead, `scripts/docker-retag-prod.sh`:

1. Inspects the merge commit's second parent (the PR branch head) to find the SHA of the already-built image.
2. Runs `docker buildx imagetools create` to push a new production tag pointing to the same manifest digest.

```
sha-<sha7>  →  <YYYYMMDD>-<run_number>-<sha7>
```

No new image layers are built or pushed.

### 4 — Production deployment

The production tag `<YYYYMMDD>-<run>-<sha7>` is what gets deployed by the GitOps repo (Flux). The date and run number provide human-readable ordering; the SHA ties the image back to the exact commit.

## Scripts reference

| Script                          | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `scripts/docker-publish-sha.sh` | Builds and pushes `sha-<sha7>` for all apps        |
| `scripts/docker-retag-prod.sh`  | Retags an existing SHA image as the production tag |
| `scripts/deploy-preview.sh`     | Deploys a PR preview environment to the cluster    |

## Local publish

To manually push a SHA-tagged image (e.g. to recover from a failed CI run):

```sh
COMMIT_SHA=$(git rev-parse HEAD) bash ./scripts/docker-publish-sha.sh
```

To manually retag as production (useful for testing the retag flow):

```sh
COMMIT_SHA=<merge-sha> RUN_NUMBER=0 bash ./scripts/docker-retag-prod.sh
```

> [!NOTE]
> Both scripts require an active Docker login to `harbor.local.abbottland.io`. Run `bash ./scripts/docker-login.sh` first if not already authenticated.
