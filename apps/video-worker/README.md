# video-worker

The purpose of this document is to explain what `video-worker` is and how the application can be developed and tested.

## Overview

`video-worker` is a persistent Node.js service that claims pending jobs created by `video-api` from PostgreSQL, processes them with `ffmpeg`, and writes results back to the NAS media root. Multiple replicas can run concurrently — jobs are claimed with `SELECT ... FOR UPDATE SKIP LOCKED`, so no two workers process the same job.

The process runs two things side by side:

- An Express server exposing `GET /healthz` (liveness, from `@abbottland/express`) and `GET /readyz` (readiness; `200` if PostgreSQL is reachable, `503` otherwise) for Kubernetes probes.
- A poll loop that repeatedly claims and processes one job at a time (one active `ffmpeg` process per pod), so CPU/memory usage per pod stays predictable.

### Job lifecycle

1. `claimNextVideoJob` atomically claims the oldest `pending` job, marking it `processing` with `workerId`, `startedAt`, and `heartbeatAt` set.
2. The job's `operation` and `parameters` are dispatched to the matching handler. Only `screenshots` is supported today: it runs `ffmpeg` once per timestamp in `parameters.timestamps`, writing `screenshots/<jobId>/<timestamp>.jpg` under `MEDIA_ROOT`.
3. On success, `completeVideoJob` sets `status: 'completed'`, `completedAt`, and `outputPaths`.
4. On failure (unsupported operation, path traversal, or an `ffmpeg` non-zero exit), `failVideoJob` sets `status: 'failed'`, `completedAt`, and `error`.
5. The loop immediately polls again for another pending job; when none are pending, it waits `POLL_INTERVAL_MS` before polling again.

`inputPath` and generated output paths are resolved relative to, and constrained within, `MEDIA_ROOT` (same `resolveWithinRoot` guard `video-api` uses for `/browse`) — a job can never read or write outside that directory.

Worker crash recovery (detecting jobs stuck in `processing` via a stale `heartbeatAt` and returning them to `pending`) is not implemented yet; jobs currently track `workerId`/`heartbeatAt` so that recovery process can be added later without a schema change.

Schema and migrations live in `@abbottland/video-db` (`packages/video-db`), shared with `video-api`. `video-worker` applies pending migrations itself at startup, the same way `video-api` does — both call `runMigrationsWithLock(config.postgres)` before doing anything else, and that function holds a Postgres advisory lock for the duration so the two apps (or multiple replicas of either) starting at the same time against a fresh database don't race to create the same tables.

## Development Procedure

### Step 1 - Set environment variables

Copy `sample.env` to `.env` and adjust as needed, or generate one via 1Password:

```sh
pnpm env:generate
```

`FFMPEG_PATH` must point at an `ffmpeg` binary on your machine (or just `ffmpeg` if it's on `PATH`).

### Step 2 - Start dependencies

```sh
pnpm dev:deps
```

This waits for Postgres to report healthy. Migrations aren't run here — `video-worker` applies them itself the moment it starts (Step 3).

> [!NOTE]
> To stop dependencies, run `pnpm dev:deps:down`. It tears down the Postgres volume too, so the **next** `pnpm dev:deps` starts from an empty database — `pnpm dev` will migrate it from scratch.

### Step 3 - Develop video-worker

```sh
pnpm dev
```

### Step 4 - Run unit and integration tests

```sh
pnpm test:unit
pnpm test:int
```

> [!NOTE]
> Integration tests run migrations against the dependency Postgres automatically before exercising the worker.

## Docker image

Unlike the other server apps, `video-worker`'s final image needs the `ffmpeg` binary, so it doesn't build directly off the shared `docker/pnpm-turbo.Dockerfile` runner stage like `video-api` does. Instead (same pattern as `apps/blog`/`apps/diagram-maker`):

- `abctl.base.yml` builds and publishes the shared Dockerfile's `builder` stage (pruned prod `node_modules` + compiled `dist`, no source) as `video-worker-base`.
- `abctl.yml` points at a local `Dockerfile`, which uses `video-worker-base` as `BASE_IMAGE` and defines its own runner stage that `apk add`s `ffmpeg`.
