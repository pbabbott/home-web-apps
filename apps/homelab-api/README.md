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
- `/sources`, `/discovery-jobs`, `/queue-items` — the exodus file-discovery queue (see [Exodus discovery queue](#exodus-discovery-queue)).
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

Exodus is the one-time migration of files from Windows machines to the NAS (full write-up, including design decisions and what is not built yet: [`docs/exodus.md`](../../docs/exodus/README.md)). An agent explores each machine directory by directory, possibly across many cron runs that start with no memory of the last, so the queue in Postgres is the only state: whatever is not written there is lost.

Three tables (`packages/homelab-db/src/schema/discovery.ts`):

- `sources` — a machine being inventoried (`name`, `sourceType`, and an optional `hostId` → `hosts.id`, so join to `hosts` for the machine's name/IP). A host with a source can't be deleted (`DELETE /hosts/:id` returns 409).
- `discovery_jobs` — one run over a source, rooted at `rootPath`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A source can have only one `pending`/`running` job at a time.
- `discovery_queue_items` — one directory to explore within a job (the job owns the lifecycle; the item tracks only its own work). Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. Unique per `(job, normalizedPath)`.
- `inventory_items` — a file or directory found while exploring a source. Unique per `(source, normalizedPath)`, so rediscovery by any job updates the same row.

### Agent workflow

1. A human registers the machine (`POST /sources`) and starts a job (`POST /sources/:id/discovery-jobs` with `rootPath`). The root is queued, and recorded as an inventory directory, automatically.
2. Each cron run loops: `POST /discovery-jobs/:id/queue-items/claim` → inspect the directory → `POST /queue-items/:id/inventory-items` with the files and directories found (up to 200 per call, chunk larger directories) → `POST /queue-items/:id/complete` with the child directories as `discoveredPaths` (completed and enqueued in one transaction) → repeat. A claim always answers `200`: `{ item }` when it got one, or `{ item: null, reason, retryAt, queueCounts }` when not. `queue_empty` means stop and complete the job; `retry_backoff` and `in_progress` mean ask again at `retryAt`.
3. Every call on a claimed item must send its `claimToken`. The claim is a lease (default 5 minutes, max 1 hour): `POST /queue-items/:id/heartbeat` extends it. If the agent crashes, the lease expires and the next claim picks the item up again; `attemptCount` and `lastError` are kept. Once the job is completed, cancelled or failed, a worker still holding an item gets `409` on every call, and cancel/fail return its in-progress items to `queued`.
4. A human watches via `GET /discovery-jobs/:id` (includes `queueCounts`), inspects problems with `GET /sources/:id/queue-items?status=failed`, and finishes with `POST /discovery-jobs/:id/complete`.

### MCP

The agent's work loop and exclusion rules are also exposed as MCP tools over stateless Streamable HTTP at `POST /mcp` (`GET`/`DELETE` return `405`), so an MCP client can drive discovery without hand-rolling REST calls. Only these routes are exposed; creating sources and jobs, enqueueing arbitrary paths, finishing/cancelling/failing a job, global rules, editing or deleting rules, review and the audit log stay REST-only for humans. Rules the agent creates are attributed to actor `openclaw` (with its optional `workerId`) in the audit log.

| MCP tool                  | REST route                                   |
| ------------------------- | -------------------------------------------- |
| `list_discovery_jobs`     | `GET /discovery-jobs`                        |
| `get_discovery_job`       | `GET /discovery-jobs/:id`                    |
| `claim_directory`         | `POST /discovery-jobs/:id/queue-items/claim` |
| `heartbeat_directory`     | `POST /queue-items/:id/heartbeat`            |
| `record_discovered_items` | `POST /queue-items/:id/inventory-items`      |
| `complete_directory`      | `POST /queue-items/:id/complete`             |
| `fail_directory`          | `POST /queue-items/:id/fail`                 |
| `skip_directory`          | `POST /queue-items/:id/skip`                 |
| `retry_directory`         | `POST /queue-items/:id/retry`                |
| `list_exclusion_rules`    | `GET /exclusion-rules`                       |
| `create_exclusion_rule`   | `POST /exclusion-rules` (source-scoped only) |

Tools call the same service layer as the controllers; not-found/conflict errors come back as tool errors (`isError`) with the same details as the REST body.

### Rules worth knowing

- **Paths** are normalized to backslashes with no trailing separator and compared case-insensitively on directory boundaries (`C:\Users\You` does not contain `C:\Users\YouOther`). Only absolute `X:\…` and UNC paths are accepted, and every enqueued path must be inside the job's root.
- **Failures:** `POST /queue-items/:id/fail` requeues a retryable failure behind an exponential backoff (30s, 60s, … capped at 1h) until `maxAttempts` (3) is used up, then marks it `failed`; `retryable: false` fails it immediately. `POST /queue-items/:id/retry` lets a human requeue a `failed` item for exactly one more attempt, but only while its job is still pending or running; to explore a finished job's failures again, start a new job.
- **Finishing:** a job completes once nothing is `queued` or `in_progress` (expired leases are reclaimed first, and an item still in retry backoff counts as queued). Permanently `failed` items do **not** block completion — the job finishes with failures, visible as `queueCounts.failed`.
- **The queue is per job.** A new job explores from its root again; what earlier jobs found is kept in `inventory_items`, which are deduplicated per source and updated (size, mtime, last-seen) rather than duplicated on rediscovery.
- **Inventory:** recorded paths must be inside the claimed directory. A missing size or mtime keeps the stored value. List with `GET /sources/:id/inventory-items` (`jobId`, `itemType`, `parentPath`, `pathPrefix`, keyset `after`/`limit`).

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
