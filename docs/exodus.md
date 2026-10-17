# Exodus

Exodus is a one-time migration of files from Windows machines to the NAS. This document records what exists so far, how it works, and the decisions made along the way. Only the **discovery orchestration** layer is built; everything downstream of it is not.

## The idea

An OpenClaw agent runs on a cron schedule. Each run starts a fresh session with no memory of the last one, so the agent cannot hold its progress in conversation history. Instead it explores a machine one directory at a time through a durable queue in Postgres: claim a directory, inspect its immediate children, record what it found, repeat. Whatever is not written to the queue is lost, so the queue is the single source of truth. Eventually the agent will submit valuable files for human review and copying to the NAS.

A human registers machines, starts and monitors jobs, and handles problems. The agent processes the work inside those jobs.

## Status

| Built                                                            | Not built                                        |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| Backup sources, discovery jobs, directory queue (database + API) | The OpenClaw agent itself                        |
| Lease-based claiming, retries, resumability                      | Filesystem scanning                              |
| Windows path normalization                                       | Inventory items (files found inside directories) |
| home-hud pages: sources, source detail, jobs                     | Exclusion rules                                  |
| Unit and integration tests                                       | Review UI, file copying to the NAS               |
|                                                                  | Authentication on the API (none, like the rest)  |

## Where things live

- **Schema, migrations, queries** — `packages/homelab-db` (`src/schema/discovery.ts`, `src/queries/discovery.ts`, migrations `0003`–`0005`). The same package and the same `homelab_api` database as `hosts`.
- **API** — `apps/homelab-api` (`controllers/`, `services/`, `schemas/discovery.ts`, `lib/windows-path.ts`). Interactive docs at `/docs`. The README has the agent workflow and the rules in short form.
- **UI** — `apps/home-hud/src/app/exodus/`, under the Exodus menu in the nav.

## Data model

Three tables:

- **`backup_sources`** — a machine being inventoried: `name` (unique), `source_type` (only `windows` today), and an optional `host_id` that references `hosts.id`, so a source can be joined to the registered host for its name and IP. Sources need not be linked to a host. The foreign key is `ON DELETE RESTRICT`: deleting a host that still has a source returns 409 instead of silently wiping its discovery history.
- **`discovery_jobs`** — one run over a source, rooted at `root_path`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A partial unique index allows only **one active (pending/running) job per source**.
- **`discovery_queue_items`** — a directory awaiting inspection. Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. Unique on `(source_id, normalized_path)`. Fields include `priority` (higher claimed first), `attempt_count`, `max_attempts` (default 3), `last_error`, `available_at` (retry backoff), and the lease (`claimed_by`, `claim_token`, `lease_expires_at`). `job_id` is nullable and records the last job that claimed or enqueued the item.

Migration history: `0003` created the tables with a `hostname` text column, `0004` replaced it with a required `host_id`, and `0005` made `host_id` optional.

## How processing works

### Claiming and leases

`POST /discovery-jobs/:id/queue-items/claim` atomically leases the highest-priority eligible item. It uses `FOR UPDATE SKIP LOCKED`, so concurrent workers never receive the same row. The response includes a `claimToken`; every later call on the item (`heartbeat`, `complete`, `fail`, `skip`) must send it, and each is rejected with 409 if the token is wrong or the lease has expired.

The lease defaults to 5 minutes (max 1 hour) and `heartbeat` extends it. If the agent crashes, the item stays `in_progress` until the lease expires. The next claim (or job completion check) first returns expired items to `queued`, so abandoned work is reclaimed and nothing stays stuck. `attempt_count` and `last_error` are kept for debugging. An expired item that has used all its attempts becomes `failed` instead.

The first claim on a pending job moves it to `running`. Claim returns 204 when nothing is claimable right now (queue empty, or only retries still in backoff).

### Exploring incrementally

`POST /queue-items/:id/complete` takes `discoveredPaths` — the child directories found inside the one just inspected. The completion and the enqueue of the children happen in **one transaction**, so a crash cannot complete a directory while losing the subdirectories it found. Every path must lie inside the job's root. Enqueuing a path that is already queued is a no-op, reported with `created: false`.

### Failures and retries

`POST /queue-items/:id/fail` records the error. A retryable failure with attempts left returns the item to `queued` behind an exponential backoff (30s, 60s, 120s, … capped at 1 hour). Otherwise — `retryable: false`, or attempts exhausted — the item becomes `failed` and stays visible. A human can then use `POST /queue-items/:id/retry`, which grants **exactly one more attempt** (`max_attempts = attempt_count + 1`) while keeping the attempt count and last error, so a still-broken directory cannot loop forever.

### Finishing a job

`POST /discovery-jobs/:id/complete` succeeds once nothing is `queued` or `in_progress`, after reclaiming expired leases. A retry that is still waiting out its backoff counts as `queued`, so it blocks completion. A permanently `failed` item does **not** block completion: the job finishes "with failures", reported as `queueCounts.failed` on the job. Otherwise the call returns 409 with the blocking `queueCounts`. Terminal jobs reject further complete/cancel/fail, enqueue and claim with 409.

### Paths

Windows paths are normalized to single backslashes with no trailing separator (a drive root keeps its `\`), with an uppercase drive letter for display. The `normalized_path` used for deduplication and comparison is the lowercased form, so `C:\Users\You` and `c:/users/you/` are the same directory. Comparison respects directory boundaries: `C:\Users\You` contains `C:\Users\You\Docs` but not `C:\Users\YouOther`. Only absolute `X:\…` and UNC `\\server\share\…` paths are accepted; relative paths, `.`/`..` segments, `\\?\` prefixes and characters Windows disallows are rejected with 400.

## API

| Method and path                                              | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `POST` / `GET /backup-sources`                               | Register / list sources                                         |
| `POST /backup-sources/:id/discovery-jobs`                    | Start a job; queues `rootPath` as its first item                |
| `GET /backup-sources/:id/discovery-jobs`                     | A source's jobs, newest first                                   |
| `GET /backup-sources/:id/queue-items`                        | Queue items; filter with `?status=` and `?jobId=`               |
| `GET /discovery-jobs`                                        | Jobs across all sources with source name and host; `?sourceId=` |
| `GET /discovery-jobs/:id`                                    | A job with `queueCounts`                                        |
| `POST /discovery-jobs/:id/{complete,cancel,fail}`            | Guarded job transitions                                         |
| `POST /discovery-jobs/:id/queue-items`                       | Enqueue paths (must be inside the job root)                     |
| `POST /discovery-jobs/:id/queue-items/claim`                 | Claim the next directory                                        |
| `POST /queue-items/:id/{heartbeat,complete,fail,skip,retry}` | Work on a claimed item; `retry` is the human one                |

## UI (home-hud)

- **`/exodus/sources`** — table of sources with their linked host, and an Add Source modal. The host is optional.
- **`/exodus/sources/[id]`** — the latest job with queue counts (refreshes itself every 5 seconds while a job is active), Start Job, Mark Complete, Cancel Job (with confirmation), failed directories with a Retry button, and job history.
- **`/exodus/jobs`** — jobs across all sources, filterable by source through a `?source=<id>` URL parameter.

## Decisions and gotchas worth knowing

- **The queue belongs to the source, not the job.** Claiming takes any queued item of the source and re-stamps it with the claiming job, so a new job picks up work left by a cancelled one and deduplication spans jobs. As a consequence `queueCounts` is source-wide: a job's counts include items from earlier jobs on the same source, which is why the jobs tables do not show per-job counts.
- **A pending job can be completed directly** if the queue is already empty (for example its root was finished by an earlier job).
- **No UI for failing a job by hand.** `POST /discovery-jobs/:id/fail` exists for the agent; the UI offers Complete and Cancel only.
- **Known small risks:** `claimToken` is visible in queue item listings, and there is no authentication. A job-completion check can race a concurrent enqueue.
- **Server actions return results instead of throwing.** Next.js redacts the message of an error thrown from a server action in production builds, and the API's messages ("already exists", "still has queued work (1 in progress)") are meant to be shown.
- **`fui-components` cannot be imported from a Server Component** — its bundle uses hooks. Pages that need to render an error state hand it to a small client component (`SourceLoadError`).
- **`drizzle-kit generate` prompts interactively** when a column is added next to a dropped one ("created or renamed?"). It needs a TTY; the migration 0004 and 0005 files were generated under a pseudo-terminal accepting the default. The generated `meta/*.json` files must also pass Prettier or the pre-commit hook rejects the commit.

## Running and testing

```sh
cd apps/homelab-api
pnpm dev:deps     # Postgres on :5433
pnpm dev          # API on :4003; applies pending migrations at startup

cd apps/home-hud
pnpm dev          # UI on :4022, pages under /exodus
```

Unit tests run with `pnpm test:unit` in `packages/homelab-db` and `apps/homelab-api`. `apps/homelab-api` also has its first integration test project (`pnpm test:int`, needs `dev:deps`): it runs end to end against the real local Postgres, covering concurrent claims, lease expiry and reclaim, retry exhaustion, completion rules and the host/source filters, and deletes everything it creates. CI picks the project up automatically through the `test:int` task. See [Postgres & Drizzle](./dev-guide-postgres-drizzle.md) and the [integration test guide](./test-guide-integration.md).

After changing `packages/homelab-db`, run `pnpm build` there: `homelab-api` loads it from `dist/` at runtime (including in Jest), so a stale build shows up as confusing "undefined" errors.

## Next steps

Not started, and not decided:

- The OpenClaw agent: how it authenticates to the API, what it inspects in each directory, and the cron cadence.
- Inventory items: recording the files found, so valuable ones can be selected for copying.
- Exclusion rules: paths or patterns the walk should skip.
- Review and copy: the human review step and copying approved files to the NAS.
