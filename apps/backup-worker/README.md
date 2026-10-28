# backup-worker

The purpose of this document is to explain what `backup-worker` is and how the application can be developed and tested.

## Overview

`backup-worker` copies approved Exodus inventory from a Windows source (SMB) to an NFS export. **One worker serves one destination** (`BACKUP_DESTINATION_ID`). The design is in [`docs/exodus/backup-design`](../../docs/exodus/backup-design/README.md), what is built in [`docs/exodus/backup.md`](../../docs/exodus/backup.md#worker).

It validates its destination, claims backup job items and copies them (hashed, staged, resumable; see [Copy engine](../../docs/exodus/backup.md#copy-engine)). Stall handling, `SIGTERM` release, source and destination pauses and `BACKUP_PARALLELISM` come in a later milestone. It calls `@abbottland/homelab-db` directly and has no HTTP routes besides `GET /healthz` and `GET /readyz`; the SMB access is `@abbottland/source-access`.

The process runs two things side by side:

- An Express server with `GET /healthz` (liveness) and `GET /readyz` (readiness). `/readyz` is `503` when PostgreSQL is unreachable, the schema is behind, or a destination call is stalled. `/healthz` is `503` only when a destination call has been stalled for longer than twice `BACKUP_STALL_TIMEOUT_SECONDS`, so Kubernetes restarts the pod.
- A poll loop that, every `POLL_INTERVAL_MS`, updates `worker_seen_at`, validates the destination at startup and whenever `validation_requested_at` is set, and then claims and copies items until there is nothing to claim. While an item is copied, `worker_seen_at` and the item's lease are kept fresh by timers.

Migrations are applied at startup under the advisory lock, as in `video-worker`.

## Development Procedure

### Step 1 - Set environment variables

Copy `sample.env` to `.env` and adjust. Locally, point `BACKUP_DESTINATION_PATH` at a scratch directory and set `BACKUP_DESTINATION_MOUNT_CHECK=none` (the result then records `mountVerified: false`). `EXODUS_CREDENTIAL_KEY` must be a 32-byte base64 value (`openssl rand -base64 32`); use the one `homelab-api` has. `BACKUP_DESTINATION_ID` is the id of a destination created through `POST /backup-destinations`.

### Step 2 - Start dependencies

```sh
pnpm dev:deps
```

The database is `homelab_api` on port 5433, the same as `apps/homelab-api`; stop one before starting the other's dependencies.

### Step 3 - Develop

```sh
pnpm dev
```

Then `POST /backup-destinations/:id/validate` on `homelab-api`: within one poll the destination shows `lastValidation`, `health` and no pending request.

To copy something, create a job with `POST /sources/:id/backup-jobs` (use `/plan` first). The worker reaches the source with the source's connection; the connection's share mappings must serve the job's paths. Everything is written under `<BACKUP_DESTINATION_PATH>/<root_dir>/<source_dir_name>/`, plus a transient `.exodus-staging` folder. Never point a local worker at a destination you care about.

### Step 4 - Tests

```sh
pnpm test:unit
pnpm test:int   # needs pnpm dev:deps
```

The copy tests (`tests/integration/copy.integration.test.ts`) use the `FakeDriver` from `@abbottland/source-access`, a temporary directory as the destination and the real local Postgres, which they clean up. They include a run that kills the worker at every fault point of a directory copy (the `fault` hook of `claimAndCopyNext`) and compares the rerun with an uninterrupted copy. One file: `pnpm exec jest --config jest.config.ts --selectProjects integration --runInBand --runTestsByPath tests/integration/copy.integration.test.ts`.

## Docker image

Same pattern as `video-worker`: `abctl.base.yml` publishes the shared `builder` stage as `backup-worker-base`; the local `Dockerfile` adds a runner stage that `apk add`s `samba-client` (used by the copy engine; `TZ=UTC` is set for it by `source-access`).
