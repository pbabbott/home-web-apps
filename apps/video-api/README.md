# video-api

The purpose of this document is to explain what `video-api` is and how the application can be developed and tested.

## Overview

`video-api` is an Express.js API that accepts video-processing job requests and stores them durably in PostgreSQL for a separate `video-worker` (built in a later session) to claim and process with `ffmpeg`. The API itself never touches video files or runs `ffmpeg` — it only creates and reports on job records.

Routes:

- `GET /healthz` — liveness check (from `@abbottland/express`); always `200` if the process is up.
- `GET /readyz` — readiness check; `200` if PostgreSQL is reachable, `503` otherwise.
- `POST /jobs` — create a job. Only the `screenshots` operation is currently supported.
- `GET /jobs/:id` — fetch a job's current status/result.
- `GET /browse?path=<relative path>` — list the files/folders at `<path>` (default: the root itself). `path` is always resolved relative to, and constrained within, `MEDIA_ROOT`; requests that attempt to traverse outside of it (e.g. `../../etc`) get a `400`.

Schema and migrations live in `@abbottland/video-db` (`packages/video-db`), shared with the future worker.

## Development Procedure

### Step 1 - Set environment variables

Copy `sample.env` to `.env` and adjust as needed, or generate one via 1Password:

```sh
pnpm env:generate
```

### Step 2 - Start dependencies

```sh
pnpm dev:deps
```

> [!NOTE]
> To stop dependencies, run `pnpm dev:deps:down`

### Step 3 - Run database migrations

```sh
DATABASE_URL=postgres://video_api:Password123@localhost:5432/video_api pnpm --filter @abbottland/video-db db:migrate
```

### Step 4 - Develop video-api

```sh
pnpm dev
```

### Step 5 - Run unit and integration tests

```sh
pnpm test:unit
pnpm test:int
```

> [!NOTE]
> Integration tests run migrations against the dependency Postgres automatically before exercising the routes.
