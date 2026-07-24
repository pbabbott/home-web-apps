# video-api

The purpose of this document is to explain what `video-api` is and how the application can be developed and tested.

## Overview

`video-api` is an Express.js API that accepts video-processing job requests and stores them durably in PostgreSQL for `video-worker` (`apps/video-worker`) to claim and process with `ffmpeg`. The API itself never touches video files (aside from `/browse` and hashing files for `/title-cards`) or runs `ffmpeg` — job processing itself is the worker's job.

Routes:

- `GET /healthz` — liveness check (from `@abbottland/express`); always `200` if the process is up.
- `GET /readyz` — readiness check; `200` if PostgreSQL is reachable, `503` otherwise.
- `POST /jobs` — create a job. Only the `screenshots` operation is currently supported.
- `GET /jobs?status=<pending|processing|completed|failed>` — list jobs, most recently created first (capped at 100), optionally filtered by status. Omit `status` to list all.
- `GET /jobs/:id` — fetch a job's current status/result.
- `GET /browse?path=<relative path>` — list the files/folders at `<path>` (default: the root itself). `path` is always resolved relative to, and constrained within, `MEDIA_ROOT`; requests that attempt to traverse outside of it (e.g. `../../etc`) get a `400`.
- `GET /hash?filePath=<relative path>` — compute and return the SHA-256 hash of the file at `filePath`, without recording anything. Same resolve-then-hash logic `POST /title-cards` and `POST /file-renames` use internally; useful for getting a `fileHash` up front to query those routes with.
- `POST /title-cards` — record the timestamp a title card (episode-title screen) was found at, for a video file at `filePath`. The file is hashed (SHA-256) server-side; the hash — not `filePath` — is the record's identity, so a later filename change doesn't orphan it. Re-submitting the same `filePath`/`timestampSeconds` pair updates the existing record instead of erroring (`201` either way).
- `GET /title-cards?fileHash=<hash>` or `?filePath=<relative path>` — list recorded title cards, most useful filtered to one file's; `filePath` is resolved and hashed the same way `POST` does. Omit both to list everything (capped at 100, ordered by `timestampSeconds`).
- `GET /title-cards/:id` — fetch a single recorded title card.
- `POST /file-renames` — record an AI-suggested destination filename (`suggestedFilePath`) for the video file at `originalFilePath`. `originalFilePath` is hashed the same way as `/title-cards`, for the same rename-survival reason; `suggestedFilePath` is only checked for path traversal, not existence — nothing renames the file automatically. One suggestion per file: re-submitting for the same file updates it and resets `status` back to `pending`.
- `GET /file-renames?fileHash=<hash>` or `?filePath=<relative path>`, optionally `&status=<pending|applied|rejected>` — list suggestions, newest first (capped at 100). Omit all filters to list everything.
- `GET /file-renames/:id` — fetch a single suggestion.
- `PATCH /file-renames/:id` — set `{ "status": "applied" | "rejected" | "pending" }`. `applied` stamps `appliedAt`; the other two clear it. This only updates the record — it doesn't touch the filesystem.
- `GET /docs` — interactive Swagger UI for the routes above. The URL is also logged at startup.

Schema and migrations live in `@abbottland/video-db` (`packages/video-db`), shared with `video-worker`.

### Request validation

`POST /jobs` and `GET /jobs/:id` validate the request body/params with Zod (`src/schemas/jobs.ts`) via the shared `validateBody`/`validateParams` middleware in `@abbottland/express`. Invalid requests get a `400` listing every problem, not just the first one:

```json
{
  "message": "Invalid request body",
  "errors": [
    {
      "field": "inputPath",
      "message": "Invalid input: expected string, received undefined"
    },
    {
      "field": "parameters.timestamps",
      "message": "timestamps must be a non-empty array of numbers"
    }
  ]
}
```

Anything that isn't a request-shape problem (e.g. the database being unreachable) still returns a generic `500` and gets logged in full server-side — see `configureErrorHandler` in `@abbottland/express`.

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

This waits for Postgres to report healthy, then runs migrations against it — you get a running, up-to-date database in one command.

> [!NOTE]
> To stop dependencies, run `pnpm dev:deps:down`. It tears down the Postgres volume too, so the **next** `pnpm dev:deps` starts from an empty (but freshly migrated) database.

### Step 3 - Develop video-api

```sh
pnpm dev
```

### Step 4 - Run unit and integration tests

```sh
pnpm test:unit
pnpm test:int
```

> [!NOTE]
> Integration tests run migrations against the dependency Postgres automatically before exercising the routes.
