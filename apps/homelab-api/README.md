# homelab-api

The purpose of this document is to explain what `homelab-api` is and how the application can be developed and tested.

## Overview

`homelab-api` is an Express.js API backing `home-hud`'s `/infra` pages — it tracks user-registered homelab hosts (physical and virtual) and enriches them with live data pulled from Prometheus and Kubernetes.

Routes:

- `GET /healthz` / `GET /readyz` — liveness/readiness checks (from `@abbottland/express`).
- `GET /maps/:type` — cluster topology map (`nodes`/`pods`) for the `/infra/cluster-map` page.
- `GET /hosts` — list hosts, optionally filtered by `?type=physical|virtual`. Each host is enriched with a live `status` (online/offline/unknown) and `cpuUsageRatio` from Prometheus.
- `POST /hosts` — register a new host (`name`, `ipAddress` required; `hostType` defaults to `physical`; `instance` is the Prometheus scrape-target address, e.g. `192.168.6.24:9100`).
- `GET /hosts/:id` — fetch a single host.
- `PATCH /hosts/:id` / `DELETE /hosts/:id` — update/remove a host.
- `GET /hosts/:id/metrics/{cpu,memory,disk-io,temperature}` — per-host time series from Prometheus over a range.
- `GET /hosts/:id/metrics/disk-space` — current filesystem usage snapshot.
- `/backup-sources`, `/discovery-jobs`, `/queue-items` — the exodus file-discovery queue (see [Exodus discovery queue](#exodus-discovery-queue)).
- `GET /docs` — interactive Swagger UI for the routes above. The URL is also logged at startup.

Schema and migrations live in `@abbottland/homelab-db` (`packages/homelab-db`); `homelab-api` applies pending migrations itself at startup, same pattern as `video-api`.

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

This waits for Postgres to report healthy.

> [!NOTE]
> To stop dependencies, run `pnpm dev:deps:down`. It tears down the Postgres volume too, so the **next** `pnpm dev:deps` starts from an empty database.

### Step 3 - Develop homelab-api

```sh
pnpm dev
```

### Step 4 - Run tests

```sh
pnpm test:unit
pnpm test:int   # needs `pnpm dev:deps`; runs against the real local Postgres
```

## Exodus discovery queue

Exodus is the one-time migration of files from Windows machines to the NAS (full write-up, including design decisions and what is not built yet: [`docs/exodus.md`](../../docs/exodus.md)). An agent explores each machine directory by directory, possibly across many cron runs that start with no memory of the last, so the queue in Postgres is the only state: whatever is not written there is lost.

Three tables (`packages/homelab-db/src/schema/discovery.ts`):

- `backup_sources` — a machine being inventoried (`name`, `sourceType`, and an optional `hostId` → `hosts.id`, so join to `hosts` for the machine's name/IP). A host with a source can't be deleted (`DELETE /hosts/:id` returns 409).
- `discovery_jobs` — one run over a source, rooted at `rootPath`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A source can have only one `pending`/`running` job at a time.
- `discovery_queue_items` — a directory awaiting inspection. Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. Unique per `(source, normalizedPath)`, so a directory is never queued twice even across jobs.

### Agent workflow

1. A human registers the machine (`POST /backup-sources`) and starts a job (`POST /backup-sources/:id/discovery-jobs` with `rootPath`). The root is queued automatically.
2. Each cron run loops: `POST /discovery-jobs/:id/queue-items/claim` → inspect the directory → `POST /queue-items/:id/complete` with the child directories as `discoveredPaths` (completed and enqueued in one transaction) → repeat until claim returns `204`.
3. Every call on a claimed item must send its `claimToken`. The claim is a lease (default 5 minutes, max 1 hour): `POST /queue-items/:id/heartbeat` extends it. If the agent crashes, the lease expires and the next claim picks the item up again; `attemptCount` and `lastError` are kept.
4. A human watches via `GET /discovery-jobs/:id` (includes `queueCounts`), inspects problems with `GET /backup-sources/:id/queue-items?status=failed`, and finishes with `POST /discovery-jobs/:id/complete`.

### Rules worth knowing

- **Paths** are normalized to backslashes with no trailing separator and compared case-insensitively on directory boundaries (`C:\Users\You` does not contain `C:\Users\YouOther`). Only absolute `X:\…` and UNC paths are accepted, and every enqueued path must be inside the job's root.
- **Failures:** `POST /queue-items/:id/fail` requeues a retryable failure behind an exponential backoff (30s, 60s, … capped at 1h) until `maxAttempts` (3) is used up, then marks it `failed`; `retryable: false` fails it immediately. `POST /queue-items/:id/retry` lets a human requeue a `failed` item for exactly one more attempt.
- **Finishing:** a job completes once nothing is `queued` or `in_progress` (expired leases are reclaimed first, and an item still in retry backoff counts as queued). Permanently `failed` items do **not** block completion — the job finishes with failures, visible as `queueCounts.failed`.
- **The queue is per source, not per job.** Claiming takes any queued item of the source, so a new job continues where a cancelled one stopped.

## Seeding hosts from a remote environment

A local database reset (`pnpm dev:deps:down`) wipes hand-registered hosts. Rather than re-entering IPs/instances by hand, `pnpm run seed:remote` pulls the full host list from a remote `homelab-api` (e.g. production) and upserts it into the local database — matching existing rows by `ipAddress` (not `id`, which is a per-environment UUID).

Production `homelab-api` has its own route on the cluster's gateway: `https://homelab-api.local.abbottland.io` (sits alongside `home-hud`'s own route on the same `istio-ingress` gateway, in the `home-hud` namespace — not actually proxied through `home-hud` itself).

```sh
REMOTE_HOMELAB_API_URL=https://homelab-api.local.abbottland.io pnpm run seed:remote
```

Output lists each host as created (`+`) or updated (`~`), e.g.:

```
Fetching hosts from https://homelab-api.local.abbottland.io/hosts ...
Got 11 host(s) from remote.
  ~ updated Bananapi (192.168.4.144)
  + created Chimaera (192.168.4.192)
  ...
Done. Created 6, updated 5.
```

> [!NOTE]
> If `@abbottland/homelab-db` was changed since its last build, rebuild it first (`pnpm --filter @abbottland/homelab-db build`) — `seed:remote` runs against the package's compiled `dist`, not its source.
