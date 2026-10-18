# Exodus

Exodus is a one-time migration of files from Windows machines to the NAS. This document records what exists so far, how it works, and the decisions made along the way. Only the **discovery orchestration** layer is built; everything downstream of it is not.

## The idea

An OpenClaw agent runs on a cron schedule. Each run starts a fresh session with no memory of the last one, so the agent cannot hold its progress in conversation history. Instead it explores a machine one directory at a time through a durable queue in Postgres: claim a directory, inspect its immediate children, record the files and directories it found as inventory items, enqueue the subdirectories, repeat. Whatever is not written to Postgres is lost, so the database is the single source of truth. Eventually the agent will submit valuable files for human review and copying to the NAS.

A human registers machines, starts and monitors jobs, and handles problems. The agent processes the work inside those jobs.

## Status

| Built                                                           | Not built                                       |
| --------------------------------------------------------------- | ----------------------------------------------- |
| Sources, discovery jobs, directory queue (database + API)       | The OpenClaw agent itself                       |
| Lease-based claiming, retries, resumability                     | Filesystem scanning                             |
| Windows path normalization                                      | Exclusion rules                                 |
| Inventory items: files and directories found (database + API)   | Review UI, file copying to the NAS              |
| home-hud pages: sources, source detail, jobs, inventory browser | Authentication on the API (none, like the rest) |
| MCP tools for the agent's work loop (`POST /mcp`)               |                                                 |
| Unit and integration tests                                      |                                                 |

## Where things live

- **Schema, migrations, queries** — `packages/homelab-db` (`src/schema/discovery.ts`, `src/queries/discovery.ts`, migrations `0003`–`0008`, and an [entity-relationship diagram](../packages/homelab-db/ERD.md)). The same package and the same `homelab_api` database as `hosts`.
- **API** — `apps/homelab-api` (`controllers/discovery/` split by domain, `services/discovery.ts`, `schemas/discovery.ts`, `lib/windows-path.ts`, `mcp.ts`). Interactive docs at `/docs`. The README has the agent workflow and the rules in short form.
- **UI** — `apps/home-hud/src/app/exodus/`, under the Exodus menu in the nav.

## Data model

Four tables. The split that matters: a **job** is one run over a source and owns the lifecycle; a **queue item** is one directory to explore _within that job_ and tracks only its own unit of work; an **inventory item** is a file or directory found, and outlives any one job.

- **`sources`** — a machine being inventoried: `name` (unique), `source_type` (only `windows` today), and an optional `host_id` that references `hosts.id`, so a source can be joined to the registered host for its name and IP. Sources need not be linked to a host. The foreign key is `ON DELETE RESTRICT`: deleting a host that still has a source returns 409 instead of silently wiping its discovery history.
- **`discovery_jobs`** — one run over a source, rooted at `root_path`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A partial unique index allows only **one active (pending/running) job per source**.
- **`discovery_queue_items`** — one directory to explore within a job. Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. `job_id` is required and cascades on delete; unique on `(job_id, normalized_path)`. The source is reached through the job. Fields: `priority` (higher claimed first), `attempt_count`, `max_attempts` (default 3), `last_error`, `available_at` (retry backoff), and the lease (`claimed_by`, `claim_token`, `lease_expires_at`). No job-level lifecycle is duplicated on items.
- **`inventory_items`** — a file or directory found while exploring a source. Unique on `(source_id, normalized_path)` (lowercased, so Windows paths match case-insensitively). Fields: `item_type` (`file` | `directory`), `path`, `parent_path` (null only for roots), `name`, `extension` (lowercased, files only), `size_bytes` (bigint), `modified_at`, `first_job_id` / `last_job_id` (set null if a job is deleted) and `first_seen_at` / `last_seen_at`.

**State checks.** `discovery_queue_items` has `CHECK`s that `0 <= attempt_count <= max_attempts` and that an `in_progress` item has `claimed_by`, `claim_token` and `lease_expires_at` all set; `inventory_items` checks `size_bytes >= 0`. The queries already keep to these, so the database now rejects an illegal state instead of storing it.

Migration history: `0003` created the tables with a `hostname` text column, `0004` replaced it with a required `host_id`, `0005` made `host_id` optional, `0006` scoped the queue to its job (see Decisions) and added `inventory_items`, `0007` added the `CHECK` constraints above, and `0008` renamed `backup_sources` to `sources` (the enum, the table and its constraints, all in place, so no data moved).

## How processing works

### Claiming and leases

`POST /discovery-jobs/:id/queue-items/claim` atomically leases the highest-priority eligible item. The whole claim is one transaction that locks the job row (so claimers are serialized per job and a concurrent cancel cannot interleave) and picks the item with `FOR UPDATE SKIP LOCKED`, so concurrent workers never receive the same row. The response includes a `claimToken`; every later call on the item (`heartbeat`, `complete`, `fail`, `skip`, `inventory-items`) must send it, and each is rejected with 409 if the token is wrong, the lease has expired, **or the job is no longer active**.

The lease defaults to 5 minutes (max 1 hour) and `heartbeat` extends it. If the agent crashes, the item stays `in_progress` until the lease expires. The next claim (or job completion check) first returns expired items to `queued`, so abandoned work is reclaimed and nothing stays stuck. `attempt_count` and `last_error` are kept for debugging. An expired item that has used all its attempts becomes `failed` instead.

Claiming only considers the claiming job's own items. The first claim on a pending job moves it to `running`. The claim always answers 200 with `{ item }`. When nothing is claimable, `item` is `null` and the response says why, so the worker loop knows whether to stop or wait:

| `reason`        | Meaning                                                                 | `retryAt`                   |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| `queue_empty`   | Nothing queued or in progress: call `POST /discovery-jobs/:id/complete` | `null`                      |
| `retry_backoff` | Queued items are waiting out a retry delay                              | earliest `available_at`     |
| `in_progress`   | Only other workers' leases remain                                       | earliest `lease_expires_at` |

The idle response also carries the job's `queueCounts`. Claiming on a finished job is 409.

### Exploring incrementally

`POST /queue-items/:id/complete` takes `discoveredPaths` — the child directories found inside the one just inspected. The completion and the enqueue of the children happen in **one transaction**, so a crash cannot complete a directory while losing the subdirectories it found. Every path must lie inside the job's root. Enqueuing a path that is already queued is a no-op, reported with `created: false`.

### Recording inventory

Creating a job also records its **root as an inventory directory** (same transaction). A worker only records what lies beneath the directory it holds, so without this the root itself could never be reviewed or marked later.

`POST /queue-items/:id/inventory-items` takes the claim token and up to 200 `{ path, itemType, sizeBytes?, modifiedAt? }` entries found inside the claimed directory (descendants are allowed, the directory itself is not; anything else is 409 and nothing is recorded). The source and job come from the claim, never from the request. Recording is an upsert on source + normalized path:

- Rediscovery by a retry, a reclaimed lease or a later job updates the same row (filesystem facts, `last_job_id`, `last_seen_at`). `id`, `first_job_id`, `first_seen_at` and `created_at` never change, and columns added later for review or copy state are not in the update, so they survive.
- A missing `sizeBytes` or `modifiedAt` keeps the stored value rather than clearing it.
- Because it is separate from `complete`, items recorded before a crash stay; the next worker repeats the call without creating duplicates.

`GET /sources/:id/inventory-items` lists by `jobId` (last seen), `itemType`, `parentPath` (direct children) or `pathPrefix`, ordered by normalized path with a keyset cursor (`after`, `limit` up to 1000).

### Failures and retries

`POST /queue-items/:id/fail` records the error. A retryable failure with attempts left returns the item to `queued` behind an exponential backoff (30s, 60s, 120s, … capped at 1 hour). Otherwise — `retryable: false`, or attempts exhausted — the item becomes `failed` and stays visible. A human can then use `POST /queue-items/:id/retry`, which grants **exactly one more attempt** (`max_attempts = attempt_count + 1`) while keeping the attempt count and last error, so a still-broken directory cannot loop forever. Retry clears the claim fields, refuses anything that is not `failed` (including an item being worked on), and **only works while the item's job is pending or running**: a failed item of a finished job can only be explored again by starting a new job.

Retrying is therefore both automatic (retryable failures with attempts left, behind a backoff) and manual (one extra attempt per human request). An attempt is counted when a claim starts, so a crash that loses the lease uses one.

### Finishing a job

`POST /discovery-jobs/:id/complete` succeeds once nothing is `queued` or `in_progress`, after reclaiming expired leases. A retry that is still waiting out its backoff counts as `queued`, so it blocks completion. A permanently `failed` item does **not** block completion: the job finishes "with failures", reported as `queueCounts.failed` on the job. Otherwise the call returns 409 with the blocking `queueCounts`. Terminal jobs reject further complete/cancel/fail, enqueue and claim with 409.

`cancel` and `fail` also **release the job's leases** in the same transaction: in-progress items go back to `queued` with no claim and `last_error = 'job cancelled'` (or `'job failed'`). A worker still holding one is rejected with 409 on its next call (`heartbeat`, `complete`, `fail`, `skip` and `inventory-items` all require an active job), so it cannot add children or inventory to a finished job. Queued and failed items are left alone as a record of what was never explored.

Completing, cancelling, failing, claiming and enqueueing all take the job row lock, so they cannot interleave: an enqueue either lands before a completion (which then refuses to finish over the new work) or waits and is rejected.

### Paths

Windows paths are normalized to single backslashes with no trailing separator (a drive root keeps its `\`), with an uppercase drive letter for display. The `normalized_path` used for deduplication and comparison is the lowercased form, so `C:\Users\You` and `c:/users/you/` are the same directory. Comparison respects directory boundaries: `C:\Users\You` contains `C:\Users\You\Docs` but not `C:\Users\YouOther`. Only absolute `X:\…` and UNC `\\server\share\…` paths are accepted; relative paths, `.`/`..` segments, `\\?\` prefixes and characters Windows disallows are rejected with 400.

## API

| Method and path                                              | Purpose                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `POST` / `GET /sources`                                      | Register / list sources                                                                      |
| `POST /sources/:id/discovery-jobs`                           | Start a job; queues `rootPath` as its first item and records it as an inventory directory    |
| `GET /sources/:id/discovery-jobs`                            | A source's jobs, newest first                                                                |
| `GET /sources/:id/queue-items`                               | Queue items; filter with `?status=` and `?jobId=`                                            |
| `GET /sources/:id/inventory-items`                           | Inventory; filter `jobId`, `itemType`, `parentPath`, `pathPrefix`, page with `after`/`limit` |
| `GET /discovery-jobs`                                        | Jobs across all sources with source name and host; `?sourceId=`                              |
| `GET /discovery-jobs/:id`                                    | A job with `queueCounts`                                                                     |
| `POST /discovery-jobs/:id/{complete,cancel,fail}`            | Guarded job transitions                                                                      |
| `GET /discovery-jobs/:id/queue-items`                        | A job's queue items; filter with `?status=`                                                  |
| `POST /discovery-jobs/:id/queue-items`                       | Enqueue paths (must be inside the job root)                                                  |
| `POST /discovery-jobs/:id/queue-items/claim`                 | Claim the next directory, or learn why there is none (`{ item: null, reason, retryAt }`)     |
| `POST /queue-items/:id/inventory-items`                      | Record files and directories found in the claimed directory                                  |
| `POST /queue-items/:id/{heartbeat,complete,fail,skip,retry}` | Work on a claimed item; `retry` is the human one                                             |

### MCP

The agent's work loop is also exposed as MCP tools at `POST /mcp` (stateless Streamable HTTP, same pattern as `gluetun-sync`; `GET`/`DELETE` return 405). The tools call the service layer directly, reuse the REST zod schemas for input, and report `DiscoveryError`s as tool errors (`isError`) with the same details as the REST body.

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

Deliberately **not** exposed (human-only, REST): creating sources and jobs, enqueueing arbitrary paths, completing/cancelling/failing a job, and the list/inventory read routes. The agent works only inside a job a human started.

## UI (home-hud)

- **`/exodus/sources`** — table of sources with their linked host, and an Add Source modal. The host is optional.
- **`/exodus/sources/[id]`** — the latest job with queue counts (refreshes itself every 5 seconds while a job is active), Start Job, Mark Complete, Cancel Job (with confirmation), failed directories (with a Retry button only while their job is still active; a finished job's failures say to start a new job), a "Browse inventory" link, and job history.
- **`/exodus/inventory`** — a read-only browser for a source's inventory, under the Exodus nav menu (Sources, Jobs, Inventory) and linked from each source page ("Browse inventory"). A Source selector at the top (`?source=<id>`) picks whose inventory to show; a missing or unknown source falls back to the first one. It starts at the latest job's root and lists a folder's direct children (folders link into themselves, with a breadcrumb trail back up); "Everything beneath it" lists every descendant with full paths, and the Type filter narrows to files or folders. Sorted by path, 100 per page with Next/First page links. All state lives in the URL (`source`, `path`, `recursive`, `type`, `after`), so a view can be bookmarked or shared, and the page is server-rendered with no client-side fetching. Switching source resets the folder to that source's job root.
- **`/exodus/jobs`** — jobs across all sources, filterable by source through a `?source=<id>` URL parameter.

## Decisions and gotchas worth knowing

- **The inventory page pages with a cursor, so it cannot go "back".** The API pages by the last `normalized_path` seen, which is stable under concurrent writes (page numbers would shift as the agent records new rows). The cost is that there is a Next link and a First page link but no Previous; the browser's Back button covers the rest because every page is its own URL. Rows are in path order, so folders and files interleave rather than folders coming first; sorting a single page would break the cursor.
- **"Everything beneath it" filters the folder itself out on the page, not in the API.** The API's path-prefix filter includes the prefix path itself, so a full page can show 99 rows. The next-page decision uses the raw row count, so a short page never hides the Next link.
- **The queue belongs to the job.** Each job explores from its own root with its own items, counts and completion check, so `queueCounts` describe that job exactly. What earlier jobs found is not lost: it lives in `inventory_items`, which are keyed by source and updated on rediscovery. (Migration `0006` replaced an earlier source-wide queue where a new job inherited a cancelled job's leftovers.)
- **Inventory batches are capped at 200 items** because the shared Express `json()` body limit is 100 kb; a larger batch would be rejected as 413 before validation.
- **No UI for failing a job by hand.** `POST /discovery-jobs/:id/fail` exists as a REST route (it is not an MCP tool, so the agent cannot call it); the UI offers Complete and Cancel only.
- **`retry_directory` is exposed to the agent, ungated.** It takes no `claimToken`, so any MCP client can requeue any failed item. Open question whether agents should be allowed to; if not, drop the tool or register it behind an env flag.
- **Known small risks:** `claimToken` is visible in queue item listings, and there is no authentication, including on `/mcp`.
- **Server actions return results instead of throwing.** Next.js redacts the message of an error thrown from a server action in production builds, and the API's messages ("already exists", "still has queued work (1 in progress)") are meant to be shown.
- **`fui-components` cannot be imported from a Server Component** — its bundle uses hooks. Pages that need to render an error state hand it to a small client component (`SourceLoadError`).
- **`drizzle-kit generate` prompts interactively** when a column is added next to a dropped one, or when a table or enum disappears next to a new one ("created or renamed?"). It needs a TTY; the migration 0004 and 0005 files were generated under a pseudo-terminal accepting the default. For a rename, the default answer is "create", which generates a drop plus a create and would lose the data: pick "rename" (Down, Enter) at each prompt. Even then it renames the table but drops and re-adds the constraints; `0008` replaces those with `RENAME CONSTRAINT` statements, which keep the same end state without re-validating every row. The snapshot drizzle writes describes the new schema regardless, so only the SQL needs hand-editing. The generated `meta/*.json` files must also pass Prettier or the pre-commit hook rejects the commit.

## Learnings

Things that were not obvious while building the job-scoped queue and inventory. Most are about Postgres, Drizzle or the test setup, and would otherwise be rediscovered the hard way.

### Modelling

- **Keep job and queue item separate.** A job is a user-requested run and owns the lifecycle; a queue item is one directory within that job and tracks only its own work. The first design made the queue source-wide (nullable `job_id` meaning "last job that touched it", dedupe per source, claims re-stamping items). That blurred the boundary and made `queueCounts` describe the source rather than the job, so it was replaced. Anything that must be remembered across jobs belongs in inventory items, keyed by source.
- **Derive instead of duplicating.** Queue items dropped `source_id` because the job already knows it. Queries that filter by source join through `discovery_jobs`.
- **Identity vs. display.** Every path-bearing table stores `path` (as typed, drive letter uppercased) next to `normalized_path` (lowercased). Dedupe uses the normalized column. Rediscovery overwrites the display form, so `c:/users/you/REPORT.PDF` after `Report.pdf` shows `C:\users\you\REPORT.PDF` on the same row.
- **Overwrite only what you own.** The inventory upsert lists the columns it updates. Columns added later for review or copy state are therefore never touched by rediscovery, with no extra code. Adding such a column to the `set` list would be the bug.
- **`first_*` / `last_*` instead of one `job_id`.** `first_job_id` and `last_job_id` answer "who found this" and "who last saw this" separately; `first_seen_at` and `last_seen_at` do the same for time. Both job columns are `SET NULL` so deleting a job never deletes inventory.
- **Take ownership from the claim, not the request.** Inventory recording looks up the source and job from the claimed queue item. A client cannot write into another source's inventory even if it sends `sourceId` in the body (the field is ignored).

### Postgres and Drizzle

- **`ON CONFLICT DO UPDATE` cannot hit the same row twice in one statement** ("cannot affect row a second time"). The batch is deduplicated by normalized path first, last occurrence winning.
- **Telling inserts from updates:** `returning (xmax = 0)` is true for a freshly inserted row and false for an updated one, so the upsert reports `created` in one round trip. It relies on Postgres internals but is a well-known idiom.
- **Drizzle `returning()` takes columns, not a table.** To add a computed column next to a whole row, spread `getTableColumns(table)` and add the `sql` expression beside it, as `recordInventoryItems` does.
- **`bigint` needs `{ mode: 'number' }`** or Drizzle returns strings. Safe up to 2^53, which is why the API caps `sizeBytes` at `Number.MAX_SAFE_INTEGER`. A 32-bit `integer` would break on files over 2 GB.
- **LIKE prefixes must be escaped.** `_` and `%` in a path are wildcards, so `my_dir` would also match `myXdir`. The prefix filter escapes `!`, `%` and `_` and uses `escape '!'`.
- **Ordering and keyset paging share the database collation.** Listing orders by `normalized_path` and the `after` cursor compares with `>` on the same column, so paging is consistent. It does not match JavaScript's `sort()` (`_` vs `X` differ), so tests must not compare against a JS sort.
- **Generating a destructive migration:** `drizzle-kit generate --name <name>` worked under `script -qec "pnpm db:generate --name x" /dev/null` (a pseudo-terminal). It orders the statements itself (drop constraint, drop index, `SET NOT NULL`, add constraint), but it does not know about data. Hand-edit the SQL to clean rows first, as `0006` does with `DELETE ... WHERE job_id IS NULL` before `SET NOT NULL`.
- **Migrations apply on startup**, including to the shared local dev database, so a destructive migration runs against whatever is in `pnpm dev:deps` the next time the API or the integration tests start.

### Concurrency and locking

- **Overlapping multi-row upserts deadlock unless they lock in the same order.** Two workers recording overlapping batches in opposite orders hit `deadlock detected` (surfacing as HTTP 500; 11 of 40 probe requests). Inventory batches are written in normalized-path order, so every transaction locks rows in the same order. Descendants of the claimed directory are allowed, so a parent worker and a child worker can genuinely overlap. A test with four opposite-order concurrent batches guards this; disabling the sort makes it fail.
- **Take the job row lock first, then item rows.** `claim`, `complete job`, `enqueue`, and `complete item` all lock the job row before touching items (claim, complete-job: `FOR NO KEY UPDATE`; enqueue, complete-item: `FOR SHARE`), and `cancel`/`fail` get the same lock from their `UPDATE`. One lock order means no deadlock between them, and it closes two races found by probing: a cancel interleaving with a claim (leaving an item in progress on a cancelled job, or resurrecting the job to `running`) and a completion interleaving with an enqueue (leaving queued work on a completed job).
- **Do not combine `FOR SHARE` with an update of the same row in the same transaction across many workers.** Two claimers each holding a share lock and each wanting to update the job to `running` would deadlock, which is why claim uses `FOR NO KEY UPDATE` (self-conflicting, so claimers queue up) instead. `FOR NO KEY UPDATE` also does not block the foreign-key check that inserting queue items does against the job row, where plain `FOR UPDATE` would.
- **A guard in the `WHERE` beats a check-then-write.** Every item mutation goes through `activeClaim`, which includes `exists (select 1 from discovery_jobs … status in ('pending','running'))`, so job status, token, state and lease are all verified by the same statement that writes. Retry uses the same job guard.
- **Probe races against the live API.** Four of the six review concerns were real bugs that the unit tests could not see. Each reproduced with a short script firing concurrent requests at the running API (deadlock, late worker after cancel, retry on a finished job, complete vs enqueue). Turn each into an integration test and check it fails without the fix.

### HTTP and API

- **The body limit is 100 kb.** `configureBaseServerMiddleware` uses `json()` with the Node default, so a body that is too large becomes a 413 that this API surfaces as a 500. Inventory batches are capped at 200 items. The existing `POST /discovery-jobs/:id/queue-items` allows 1000 paths and could hit the same limit with long paths.
- **A claim with nothing to give is still `200`.** A bare `204` could not tell a worker to stop from a worker to wait. The body carries `reason`, `retryAt` and the job's `queueCounts`; success is `{ item }`.
- **A path must lie inside the claimed directory** (strictly, not the directory itself) to be recorded. Rejecting the whole batch with 409 and listing the offending paths keeps a buggy worker from half-recording a directory.
- **Recording is separate from completing.** Items recorded before a crash persist; the reclaiming worker records again and the upsert makes that idempotent. Folding inventory into `complete` would lose a large directory's progress on a crash and could not be chunked.
- **Duplicate OpenAPI keys fail the typecheck.** A path object can only appear once in `openapi.ts`; adding `get` to a path that already has `post` means merging into the existing entry.

### Testing

- **Mocked-route unit tests need every new service function in the `jest.mock` factory** in `tests/unit/discovery.unit.test.ts`, or the route throws on an undefined function.
- **The integration suite runs against the real dev database** and deletes what it creates by deleting sources (jobs, queue items and inventory cascade). A test that creates data another way must clean it up itself.
- **Simulate time by editing rows.** Lease expiry and retry backoff are tested by updating `lease_expires_at` / `available_at` directly rather than sleeping.
- **Prove "does not reset" by backdating.** To check that `first_seen_at` survives rediscovery, backdate it first; otherwise a reset to `now()` is indistinguishable from the original.
- **Rebuild `homelab-db` after changing it** (`pnpm build`), because `homelab-api` runs against `dist/`, including under Jest.

## Running and testing

```sh
cd apps/homelab-api
pnpm dev:deps     # Postgres on :5433
pnpm dev          # API on :4003; applies pending migrations at startup

cd apps/home-hud
pnpm dev          # UI on :4022, pages under /exodus
```

Unit tests run with `pnpm test:unit` in `packages/homelab-db` and `apps/homelab-api`. `apps/homelab-api` also has its first integration test project (`pnpm test:int`, needs `dev:deps`): it runs end to end against the real local Postgres, covering concurrent claims and inventory writes, lease expiry and reclaim, retry exhaustion, completion rules, the cancel/fail and enqueue races, the database state checks, inventory recording and listing, and the host/source filters, and deletes everything it creates. `apps/home-hud` has unit tests (`pnpm test:unit`) for the inventory page helpers (sizes, breadcrumbs, URLs). CI picks the project up automatically through the `test:int` task. See [Postgres & Drizzle](./dev-guide-postgres-drizzle.md) and the [integration test guide](./test-guide-integration.md).

After changing `packages/homelab-db`, run `pnpm build` there: `homelab-api` loads it from `dist/` at runtime (including in Jest), so a stale build shows up as confusing "undefined" errors.

## Next steps

Not started, and not decided:

- The OpenClaw agent: how it authenticates to the API and MCP endpoint, what it inspects in each directory, and the cron cadence.
- Exclusion rules: paths or patterns the walk should skip.
- Detecting inventory items that disappeared between scans (`last_seen_at` makes this possible).
- Review actions on the inventory page (mark not needed, select for copy), name search, and a per-job filter.
- Review and copy: the human review step and copying approved files to the NAS.
