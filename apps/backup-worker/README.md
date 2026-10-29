# backup-worker

The purpose of this document is to explain what `backup-worker` is and how the application can be developed and tested.

## Overview

`backup-worker` copies approved Exodus inventory from a Windows source (SMB) to an NFS export. **One worker serves one destination**, which it claims by itself: the one that is the export mounted at `BACKUP_DESTINATION_PATH`, or, locally, the only free one (`BACKUP_DESTINATION_ID` pins it explicitly). The design is in [`docs/exodus/backup-design`](../../docs/exodus/backup-design/README.md), what is built in [`docs/exodus/backup.md`](../../docs/exodus/backup.md#worker).

It validates its destination, claims backup job items and copies them (hashed, staged, resumable; see [Copy engine](../../docs/exodus/backup.md#copy-engine)). It pauses a job whose source is unreachable and the jobs of a destination that is unhealthy (no attempts are spent), releases the item in flight on `SIGTERM`, stops extending the lease when a destination call stalls, and copies `BACKUP_PARALLELISM` files of an item at once (see [Pauses and shutdown](../../docs/exodus/backup.md#pauses-and-shutdown)). It calls `@abbottland/homelab-db` directly and has no HTTP routes besides `GET /healthz` and `GET /readyz`; the SMB access is `@abbottland/source-access`.

The process runs two things side by side:

- An Express server with `GET /healthz` (liveness) and `GET /readyz` (readiness). `/readyz` is `503` when PostgreSQL is unreachable, the schema is behind, or a destination call is stalled. `/healthz` is `503` only when a destination call has been stalled for longer than twice `BACKUP_STALL_TIMEOUT_SECONDS`, so Kubernetes restarts the pod; meanwhile the worker stops extending the item's lease and reporting `worker_seen_at`.
- A poll loop that, every `POLL_INTERVAL_MS`, updates `worker_seen_at`, validates the destination at startup, whenever `validation_requested_at` is set and, with a backoff, while it is `unhealthy`, and then claims and copies items until there is nothing to claim. While an item is copied, `worker_seen_at` and the item's lease are kept fresh by timers.

Migrations are applied at startup under the advisory lock, as in `video-worker`.

## Development Procedure

### Step 1 - Set environment variables

Run `pnpm env:generate` (needs `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN`), then `pnpm dev`. It copies `sample.env` to `.env` and fills `EXODUS_CREDENTIAL_KEY` from 1Password (item `exodus-credential-key`, the same value `homelab-api` gets). The sample works as it is: `BACKUP_DESTINATION_PATH` is a scratch directory the worker creates because `BACKUP_DESTINATION_MOUNT_CHECK=none` (the result then records `mountVerified: false`), and `BACKUP_DESTINATION_ID` is empty, so the worker claims the destination you registered (Add Destination on `/exodus/backup`). With several destinations registered, set `BACKUP_DESTINATION_ID` to pick one.

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

The copy tests (`tests/integration/copy.integration.test.ts`) use the `FakeDriver` from `@abbottland/source-access`, a temporary directory as the destination and the real local Postgres, which they clean up. They include a run that kills the worker at every fault point of a directory copy (the `fault` hook of `claimAndCopyNext`) and compares the rerun with an uninterrupted copy. The resilience tests (`tests/integration/resilience.integration.test.ts`) cover the failure modes: a source that stops sending, an unreachable source, a destination call that never returns, NFS errnos, `SIGTERM` mid-copy, a cancelled job, human retry and rerun, lease expiry and `BACKUP_PARALLELISM` above 1. One file: `pnpm exec jest --config jest.config.ts --selectProjects integration --runInBand --runTestsByPath tests/integration/copy.integration.test.ts`.

## Docker image

Same pattern as `video-worker`: `abctl.base.yml` publishes the shared `builder` stage as `backup-worker-base`; the local `Dockerfile` adds a runner stage that `apk add`s `samba-client` (used by the copy engine; `TZ=UTC` is set for it by `source-access`).
