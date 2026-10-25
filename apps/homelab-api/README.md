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

Tables (`packages/homelab-db/src/schema/discovery.ts`; design in [`docs/exodus/inventory.md`](../../docs/exodus/inventory.md)):

- `sources` — a machine being inventoried (`name`, `sourceType`, and an optional `hostId` → `hosts.id`, so join to `hosts` for the machine's name/IP). A host with a source can't be deleted (`DELETE /hosts/:id` returns 409).
- `discovery_jobs` — one run over a source, rooted at `rootPath`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A source can have only one `pending`/`running` job at a time.
- `discovery_queue_items` — one directory to explore within a job (the job owns the lifecycle; the item tracks only its own work). Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. Unique per `(job, normalizedPath)`.
- `inventory_items` — the agent's proposed backup unit (project, personal-data folder, standalone file) with `recommendation` (`back_up` | `skip` | `needs_review`), `confidence` (`low` | `medium` | `high`), reason and evidence, plus the human `decision` (`pending` | `approved` | `rejected`). Unique per `(source, normalizedRootPath)`; rediscovery updates the agent fields and never the decision.

### Agent workflow

0. Optional, for the review UI: a human can save how to reach the machine's files (`PUT /sources/:id/connection`, tested with `POST /sources/:id/connection/test`) and then preview inventory and skipped files with `GET /sources/:id/preview?path=` (a `.zip` returns a JSON listing of its entries, read from the end of the archive), and list what a skipped name pattern (`*.exe`) matched with `GET /queue-items/:id/skipped-group-matches?pattern=` (files matching a recorded pattern can be previewed too). Needs `EXODUS_CREDENTIAL_KEY` (see `sample.env`) and `smbclient` on the host. Not exposed over MCP; see `docs/exodus/decisions.md`.
1. A human registers the machine (`POST /sources`, edited later with `PATCH /sources/:id`: name and host link) and starts a job (`POST /sources/:id/discovery-jobs` with `rootPath`). The root is queued automatically.
2. Each cron run loops: `POST /discovery-jobs/:id/queue-items/claim` → inspect that one directory (the API grants no filesystem access; the agent uses its own read-only access) → for each thing found, **skip** it (list it in `skipped` with a reason, or many similar direct entries by name pattern in `skippedGroups`), **explore** it (a `discoveredPaths` follow-up with a `reason`), or **propose** it with `POST /queue-items/:id/inventory-items` (≤10 per call; a repository is one inventory item, never its subfolders) → `POST /queue-items/:id/complete` with the follow-ups, `skipped` and a `summary` (completed and enqueued in one transaction) → repeat. A claim always answers `200`: `{ item }` when it got one, or `{ item: null, reason, retryAt, queueCounts }` when not. `queue_empty` means stop and complete the job; `retry_backoff` and `in_progress` mean ask again at `retryAt`.
3. Every call on a claimed item must send its `claimToken`. The claim is a lease (default 5 minutes, max 1 hour): `POST /queue-items/:id/heartbeat` extends it. If the agent crashes, the lease expires and the next claim picks the item up again, spending that attempt; `attemptCount`, `lastClaimedBy` and a `lastError` naming the worker and attempt (`lease expired (worker w1, attempt 2/3)`) are kept, and the item becomes `failed` only once `maxAttempts` is used up. `POST /queue-items/claim` (MCP `claim_next_directory`) claims from the oldest active job with work (optionally one `sourceId`), so an empty cron tick is one call: `queue_empty` means stop. Every job the API returns (`GET /discovery-jobs`, `/discovery-jobs/:id`, `/sources/:id/discovery-jobs`, and `list_discovery_jobs` via MCP) carries a summary: `queueCounts`, `staleClaims` (expired leases not yet reclaimed), `lastActivityAt`, `lastWorker` and, while active, `phase` (`work_remaining`, `stuck_claims` or `awaiting_completion`). `POST /queue-items/:id/release` hands a claim back unfinished and refunds the attempt, so a bounded run leaves nothing claimed. `complete` and `skip` are safe to repeat with the same `claimToken` after a lost response. Once the job is completed, cancelled or failed, a worker still holding an item gets `409` on every call, and cancel/fail return its in-progress items to `queued`.
4. A human watches via `GET /discovery-jobs/:id` (includes `queueCounts`), inspects problems with `GET /sources/:id/queue-items?status=failed`, finishes with `POST /discovery-jobs/:id/complete`, and approves or rejects inventory items with `PATCH /inventory-items/:id/decision` (human actor only; agent recommendations never decide). A wrongly skipped path is promoted to an already-approved inventory item with `POST /queue-items/:id/promote` (human actor only, REST only; see [Promoting a skipped path](../../docs/exodus/inventory.md#promoting-a-skipped-path)).

### MCP

The agent's work loop, inventory item proposals and exclusion rules are also exposed as MCP tools over stateless Streamable HTTP at `POST /mcp` (`GET`/`DELETE` return `405`), so an MCP client can drive discovery without hand-rolling REST calls. Only these routes are exposed; creating sources and jobs, enqueueing arbitrary paths, finishing/cancelling/failing a job, global rules, editing or deleting rules, approving or rejecting inventory items and the audit log stay REST-only for humans. The server also sends the agent playbook as MCP `instructions`, and tool results are compact projections of the REST rows (`src/mcp-results.ts`), not the rows themselves. Rules the agent creates are attributed to actor `openclaw` (with its optional `workerId`) in the audit log.

| MCP tool                  | REST route                                   |
| ------------------------- | -------------------------------------------- |
| `list_discovery_jobs`     | `GET /discovery-jobs`                        |
| `get_discovery_job`       | `GET /discovery-jobs/:id`                    |
| `claim_next_directory`    | `POST /queue-items/claim`                    |
| `claim_directory`         | `POST /discovery-jobs/:id/queue-items/claim` |
| `heartbeat_directory`     | `POST /queue-items/:id/heartbeat`            |
| `propose_inventory_items` | `POST /queue-items/:id/inventory-items`      |
| `list_known_skips`        | `GET /sources/:id/known-skips`               |
| `list_inventory_items`    | `GET /sources/:id/inventory-items`           |
| `complete_directory`      | `POST /queue-items/:id/complete`             |
| `fail_directory`          | `POST /queue-items/:id/fail`                 |
| `skip_directory`          | `POST /queue-items/:id/skip`                 |
| `release_directory`       | `POST /queue-items/:id/release`              |
| `list_exclusion_rules`    | `GET /exclusion-rules`                       |
| `create_exclusion_rule`   | `POST /exclusion-rules` (source-scoped only) |

Tools call the same service layer as the controllers; not-found/conflict errors come back as tool errors (`isError`) with the same details as the REST body.

### Rules worth knowing

- **Paths** are normalized to backslashes with no trailing separator and compared case-insensitively on directory boundaries (`C:\Users\You` does not contain `C:\Users\YouOther`). Only absolute `X:\…` and UNC paths are accepted, and every enqueued path must be inside the job's root.
- **Failures:** `POST /queue-items/:id/fail` requeues a retryable failure behind an exponential backoff (30s, 60s, … capped at 1h) until `maxAttempts` (3) is used up, then marks it `failed`; `retryable: false` fails it immediately. `POST /queue-items/:id/retry` lets a human requeue a `failed` item for exactly one more attempt, but only while its job is still pending or running; to explore a finished job's failures again, start a new job. `POST /discovery-jobs/:id/retry-failed` does the same for every failed item of an active job (home-hud "Retry all failed"). Neither is an MCP tool.
- **Finishing:** a job completes once nothing is `queued` or `in_progress` (expired leases are reclaimed first, and an item still in retry backoff counts as queued). Permanently `failed` items do **not** block completion — the job finishes with failures, visible as `queueCounts.failed`.
- **The queue is per job.** A new job explores from its root again; what earlier jobs found is kept in `inventory_items`, which are deduplicated per source and updated rather than duplicated on rediscovery.
- **Inventory items:** a proposal's path must be the claimed directory or inside it. Guardrails (400): `back_up`/`skip` need `medium` or `high` confidence, and a git repository is only skippable with known-clean local state. Paths under an exclusion rule are 409. List with `GET /sources/:id/inventory-items` (`jobId`, `recommendation`, `decision`, `pathPrefix`, keyset `after`/`limit`). Confidence is `high` = direct evidence settles it, `medium` = strong signals with minor unknowns, `low` = a guess (must be `needs_review`).
- **Known skips:** `GET /sources/:id/known-skips` lists paths earlier jobs chose not to explore and name patterns (`pattern`, `count`, with `path` the directory) (from their stored `skipped` and `skippedGroups`).
- **Skip acknowledgements:** a human marks a skip as reviewed. `POST /queue-items/:id/skip-acknowledgements` (`{ path, pattern? }`, human only, idempotent), `DELETE` the same route to undo, `GET /sources/:id/skip-acknowledgements` (`pathPrefix`, `limit`) to list. Kept per source and path, so it holds for later jobs that skip the same path. Not MCP tools.
- **Mixed directories (Downloads):** never propose the folder itself. Each keeper is its own `kind: file` item, junk goes in `skippedGroups`, archives are not extracted, and a large directory is heartbeated and proposed in batches of 10. See [Exodus inventory](../../docs/exodus/inventory.md#mixed-directories-downloads). A per-run judgment the agent may revisit, not an exclusion rule.
- **Exclusions at enqueue:** follow-ups under an `exclude_subtree` rule are `skipped` as soon as they are queued, and each claim rechecks.

## Seeding hosts and exodus data from a remote environment

A local database reset (`pnpm dev:deps:down`) wipes hand-registered hosts. Rather than re-entering IPs/instances by hand, `pnpm run seed:remote` pulls the full host list from a remote `homelab-api` (e.g. production) and upserts it into the local database — matching existing rows by `ipAddress` (not `id`, which is a per-environment UUID).

Production `homelab-api` has its own route on the cluster's gateway: `https://homelab-api.local.abbottland.io` (sits alongside `home-hud`'s own route on the same `istio-ingress` gateway, in the `home-hud` namespace — not actually proxied through `home-hud` itself).

```sh
pnpm run seed:remote   # REMOTE_HOMELAB_API_URL overrides the prod default
```

To bring a local environment to prod parity from scratch, `pnpm run dev:sync-prod` wipes the local Postgres volume, restarts it, and runs `seed:remote`, which applies migrations before seeding.

Output lists each host as created (`+`) or updated (`~`), e.g.:

```
Fetching hosts from https://homelab-api.local.abbottland.io/hosts ...
Got 11 host(s) from remote.
  ~ updated Bananapi (192.168.4.144)
  + created Chimaera (192.168.4.192)
  ...
Done. Created 6, updated 5.
```

After hosts, the script also syncs the exodus discovery tables from the remote: `sources` (matched by `name`; `hostId` re-pointed at the local host with the same IP), `discovery_jobs` and `discovery_queue_items` (remote ids kept so they stay linked), `inventory_items` (matched by source + root path; the remote recommendation **and human decision** overwrite local ones), `exclusion_rules` (matched by source + path) and `audit_events` (appended, existing ones kept). It is an upsert, so re-running refreshes rows and never deletes local-only data.

> [!NOTE]
> A remote `pending`/`running` job conflicts with a different local active job on the same source (one-active-job-per-source index); the sync fails in that case.

> [!NOTE]
> If `@abbottland/homelab-db` was changed since its last build, rebuild it first (`pnpm --filter @abbottland/homelab-db build`) — `seed:remote` runs against the package's compiled `dist`, not its source.
