# Exodus Backup: what is built

[← Project Exodus](./README.md)

Copying approved inventory to an NFS destination. The design is in [backup-design](./backup-design/README.md); this page describes only what exists.

**Built so far:** the data model and the queries in `packages/homelab-db` (milestone M1, migration `0016_backup`), the shared SMB package `packages/source-access` (M0, extended in M4 with tree listing, batched `allinfo`, streaming reads and a fake driver), the REST API in `apps/homelab-api` (M2), the worker scaffold with destination validation (M3), the copy engine (M4) and its resilience (M5: pauses, shutdown, a stalled mount, parallelism) in `apps/backup-worker`. A created job is claimed and copied, and survives an unreachable source, a broken destination and a restart. The home-hud pages (M6) show destination health, plan and create a job, follow it, and report coverage; see [UI](./ui.md#backup).

## Data model

Four tables, drawn in [`packages/homelab-db/ERD.md`](../../packages/homelab-db/ERD.md):

- `backup_destinations`: an NFS export (expected `server` and `exportPath`, optional relative `root_dir`), with `enabled`, a `health` the worker writes, and `validation_requested_at` / `worker_seen_at` for the API-to-worker handshake.
- `backup_jobs`: one attempt to copy a frozen selection from a source to a destination. At most one `planned` or `running` job per (source, destination). `stalled_reason` pauses claims while the job stays `running`.
- `backup_job_items`: the snapshot of one inventory item, the leased unit of work and its result. 3 attempts for a file, 5 for a directory.
- `backup_entries`: one row per file or directory under a job item: the manifest, the resume state and the store for source metadata (times, attributes, streams, `Zone.Identifier`).

`audit_events` has three more ids without foreign keys (`destination_id`, `backup_job_id`, `backup_job_item_id`) and the `backup_*` event types. CHECK constraints enforce the state invariants (claim fields while `in_progress`, hash and path for a verified file entry, an issue kind for a failed one).

## Queries

All in `packages/homelab-db/src/queries/backup/`, exported from the package.

- **Audit is written by the queries**, in the same transaction as the change, because the worker calls them directly and has no API in between. The caller passes an `Actor` for human actions; worker events use actor `system` with the worker id. There are no per-file events; lease expiry writes one batched event per call.
- **Claiming** (`claimNextBackupItem`) serves a destination's active jobs oldest first: lock the job row (`FOR NO KEY UPDATE`), expire leases, pick an item (`FOR UPDATE SKIP LOCKED`), move `planned` to `running` on the first claim. Expiry spends the attempt; `releaseBackupItem` refunds it. Every item write is guarded by the live claim and an active job (`activeItemClaim`).
- **Nothing to claim** is a normal answer: `{ item: null, reason, retryAt, drainedJobIds }`, with `reason` one of `queue_empty`, `retry_backoff`, `in_progress`, `destination_disabled`, `destination_unhealthy`, `source_unreachable`. A disabled destination, an `unhealthy` one (health `unknown` still claims) and a job with a `stalled_reason` hand out nothing and spend no attempts. The worker runs `completeBackupJobIfDone` for each id in `drainedJobIds`.
- **Finishing an item.** `completeBackupItem` requires `enumeration_complete` and no `pending` or `failed` entry; a file item has one entry, so the worker records it first. `failBackupItem` takes `kind: 'transient'` (requeue behind the discovery backoff, then `failed` when attempts run out) or `'permanent'` (`blocked` at once). A repeat call with the same token answers from the settled row; settled items keep their token for that, a requeue clears it.
- **Human retry** grants exactly one more attempt to a `failed` or `blocked` item, only while the job is active.
- **Job outcome** (`completeBackupJobIfDone`): `completed` when every item is verified, skipped or excluded; `completed_with_issues` if any is failed or blocked. Cancel and fail release leases and leave `queued` items queued.
- **Entries.** `upsertBackupEntries` is guarded by the item's claim, sorts each batch by path (one lock order) and writes in chunks of 500. A re-enumeration never duplicates a row, never changes a `verified` entry, makes a `failed` one `pending` again, and never overwrites a recorded `src_*` value (first capture wins, also in `captureBackupEntryMetadata`). `Zone.Identifier` is cut at 4096 characters. `normalized_rel_path` is lowercased, relative to the item root and backslash-separated, because coverage compares it with inventory paths.
- **Coverage** (`getBackupCoverage`) has no table: it derives one bucket per inventory item for a (source, destination) from job items and entries and reports `allAccounted`. `undecided`, `pending`, `failed`, `blocked` and `never_attempted` block it. `never_attempted` also holds approved items whose jobs ended without trying them (a cancelled job leaves them `queued`). Verified data is never deleted, so a later failure does not revoke `covered`; `latestAttempt` shows the newest job item beside it. Discovery review status is added by the API (below), not here.

## API

All in `apps/homelab-api` (`services/backup/`, `controllers/backup/`, `routes/backup/`, OpenAPI under `/docs`), REST only and **human only**: a request with another `X-Actor-Type` gets `403`. There are no MCP tools. The services pass an `Actor` to the queries, which write the audit events; the API writes none itself, so a rejected request writes none.

| Route                                                                                          | Purpose                                                                                       |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST` / `GET /backup-destinations`, `GET` / `PATCH /backup-destinations/:id`                  | Register, list, fetch, edit a destination                                                     |
| `POST /backup-destinations/:id/{validate,enable,disable}`                                      | `validate` is `202` and sets `validation_requested_at`; enable and disable are idempotent     |
| `POST /sources/:id/backup-jobs/plan`                                                           | Dry run                                                                                       |
| `POST /sources/:id/backup-jobs`                                                                | Create a `planned` job                                                                        |
| `GET /backup-jobs`, `GET /backup-jobs/:id`                                                     | Jobs with `progress` (counts derived from items and entries) and `stalledReason`              |
| `POST /backup-jobs/:id/{cancel,fail}`                                                          | Guarded transitions (`fail` takes `{ error }`)                                                |
| `POST /backup-jobs/:id/retry-failed`, `POST /backup-job-items/:id/retry`                       | One more attempt each; only while the job is active                                           |
| `POST /backup-jobs/:id/rerun-unresolved`                                                       | New job from the failed and blocked items of a finished job                                   |
| `GET /backup-jobs/:id/items`, `GET /backup-job-items/:id`, `GET /backup-job-items/:id/entries` | Item results and per-file entries; paged with `next` as `after`; `claimToken` is not returned |
| `GET /sources/:id/backup-coverage?destinationId=&bucket=&format=json`                          | Coverage report and its JSON download                                                         |

**There is no `start` route.** Creating a job makes it ready; the destination's worker claims its first item and that moves it from `planned` to `running` (the same as a discovery job).

**Destinations.** `server` is a host name or address, `exportPath` is absolute with no `..`, `rootDir` is relative with no `..` or backslash (blank means the mount root). The response adds `workerStale`: true when `worker_seen_at` is older than two minutes or unset, i.e. no worker would pick up a validation request. Changing `settings` or `rootDir` is refused (409) while the destination has a `planned` or `running` job or any verified item; a rename is always allowed.

**Planning** (`services/backup/planner.ts` is a pure function; `planning.ts` loads the inputs). For the source's inventory matching the selection (`inventoryItemIds`, `pathPrefix`, `kinds`; `skipAlreadyCovered` defaults to true), in path order:

1. not `approved`: listed under `notEligible`, not part of the job;
2. under an `exclude_subtree` rule: `excluded` (`excluded_by_rule`);
3. inside an approved directory that this job copies, with no rejected item in between: `skipped` (`redundant_nested`), covered by that directory;
4. already covered at the destination (coverage bucket `covered` or `redundant_covered`): `skipped` (`already_covered`);
5. otherwise `queued`, 3 attempts for a file and 5 for a directory. A queued directory records `carve_outs`: the rejected inventory items and `exclude_subtree` rules inside it, outermost only.

A directory the job does not copy (already covered, excluded) does not cover what is inside it; the nested item is planned on its own, where identical files are adopted. `dest_rel_path` is `C:\Users\Me` -> `C/Users/Me` (`UNC/server/share/…` for UNC paths), or the path of an earlier verified copy so a changed spelling cannot split the tree. `source_dir_name` is a slug of the source name, reused from the source's latest job at the destination; a name another source already uses there is a 409. The plan reports counts, the summed size estimate and how many queued items have none (the estimate is then a floor), and warnings: `discovery_job_active`, and `destination_folder_exists` / `destination_folder_unknown` from `last_validation.rootEntries`, which the worker reports (the API cannot see the NAS). A source that already used the folder gets no folder warning. It is refused with 409 for a disabled destination, an active job for the (source, destination), a taken folder name, or nothing to back up (the selection matches no inventory items, or none is approved; the body then lists up to 50 `notEligible` items). `create` runs the same code and inserts in one transaction; the scope is frozen from then on.

**Rerun.** `rerun-unresolved` collects the inventory items of the finished job's `failed` and `blocked` items and creates a new job for them through the normal planning, so anything verified since is skipped and current decisions and rules apply.

**Coverage report.** The query's report plus `source`, `destination`, `scope` (inventory items, with per-file verification for directory items, subject to the stated limits), `limits` (the five things coverage cannot promise: files hidden from the SMB account, inventory rather than the whole disk, a file modified during the copy, ACLs and other alternate streams, source access times), `notes` (kept-both files, not-followed entries) and `discoveryReview`. Rejected items are counted but left out of `items` unless `bucket=rejected` is asked for (`omittedRejected` says how many). `format=json` returns the full report (every item, `bucket` ignored) as an attachment named `backup-coverage-<source>-<destination>-<date>.json`. `discoveryReview` is display only and never changes `allAccounted`: across all of the source's `completed` discovery jobs it counts directories reviewed, not reviewed, unknown (no result) and not explored, with the same rule as the discovery pages. A directory several jobs visited is counted once, from the newest job that has it. `jobs` lists the jobs counted, and `truncated` says when a job has more directories than are counted (500 each).

## Worker

`apps/backup-worker` ([README](../../apps/backup-worker/README.md)) is modelled on `video-worker`: an Express server plus a poll loop, migrations at startup under the advisory lock, the image built with `samba-client`. **One worker serves one destination** (`BACKUP_DESTINATION_ID`). It calls `homelab-db` queries directly and has no routes besides `GET /healthz` and `GET /readyz`. The poll loop claims and copies items (see [Copy engine](#copy-engine)).

**Configuration** (environment; defaults in `src/config.ts`, example in `sample.env`):

| Variable                                           | Default     | Purpose                                                                                           |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST/PORT/DATABASE/USER/PASSWORD`        | as the API  | The shared `homelab_api` database                                                                 |
| `EXODUS_CREDENTIAL_KEY`                            | required    | 32 bytes, base64; the same value as `homelab-api`. Checked at startup, used by the copy engine    |
| `BACKUP_DESTINATION_ID`                            | required    | UUID of the destination this worker serves                                                        |
| `BACKUP_DESTINATION_PATH`                          | required    | Absolute container path of the mounted export. Existence is checked by validation, not at startup |
| `BACKUP_DESTINATION_MOUNT_CHECK`                   | `nfs`       | `none` for local development only; the result then has `mountVerified: false`                     |
| `BACKUP_STALL_TIMEOUT_SECONDS`                     | `120`       | No-progress timeout for destination calls (the watchdog) and for source reads                     |
| `POLL_INTERVAL_MS`                                 | `5000`      | Poll interval; the API treats a worker as stale after 2 minutes (`WORKER_STALE_AFTER_MS`)         |
| `BACKUP_HEARTBEAT_SECONDS`, `BACKUP_LEASE_SECONDS` | `60`, `300` | Lease length and how often it is extended while an item is copied                                 |
| `BACKUP_PARALLELISM`                               | `1`         | Files of one item copied at once (see [Parallelism](#parallelism-and-memory))                     |

**Poll loop.** Every poll calls `touchBackupDestinationWorker` (`worker_seen_at`). The worker validates its destination on the first poll and whenever `validation_requested_at` is set, then stores the result with `recordBackupDestinationValidation`, which sets `health` (`ok` or `unhealthy`), `last_validated_at` and `last_validation`, clears the request, and writes the `validated` or `unhealthy` audit event. A request made while it validates is cleared too. Then it copies (below). A missing destination row or a database error is logged and the loop carries on.

A destination whose `health` is `unhealthy` is **validated again by itself** once its backoff is over (30 s, doubling to 5 minutes), without waiting for a human to press Validate. A validation that passes resumes the jobs paused as `destination_unhealthy`; one that fails pauses them (see [Pauses](#pauses-and-shutdown)).

**Validation** (`src/destination/validate.ts`; `/proc/mounts`, the filesystem, the clock and the random id are injected). Checks run in order and stop at the first fatal one:

1. `mount`: `BACKUP_DESTINATION_PATH` is a mount point whose entry is `nfs` or `nfs4` with device `settings.server:exportPath`. Skipped with the check set to `none`; `mountVerified` is then `false`.
2. `root`: the mount path is a directory; `<mount>/<root_dir>` stays inside the mount, has no symlink in any existing component (`lstat`), and is created if missing.
3. `probe`: in a transient `.exodus-probe-<random>/` folder under the root: write, `fsync`, read back and compare a SHA-256; `link()` and a second `link()` onto the same name that must fail with `EEXIST`; `rename`; `utimes` and a `stat` round trip; a 255-byte name; a case-variant pair; names with spaces, a trailing dot and non-ASCII. The folder is removed in a `finally`; a removal failure is its own failed check (`probe_cleanup`). Nothing else is written.

`last_validation` holds `ok`, `mountVerified`, `checks` (`{ name, ok, message }`), `findings` and `rootEntries`. Findings: `mountPath`, `checkedAt`, `mount` (device, type, options), `utimesSupported`, `maxNameLength`, `rejects256ByteName`, `caseSensitive`, `uid`, `gid`, `freeBytes`, `totalBytes` (information only; a failed `statfs` is `statfsError`), and `rootEntriesTruncated` (the real count) when the listing was cut.

**`rootEntries`** are the names directly under `<mount>/<root_dir>`, sorted, listed read-only before the probe writes, capped at 1000, without `.exodus-probe-*` and `.exodus-staging`. The API's plan warning (`destination_folder_exists` / `destination_folder_unknown`) reads it; before a validation has run there is none.

**Watchdog and probes.** Every destination call (the whole validation today; copy I/O later) runs under `DestinationWatchdog`. A call that has not returned after `BACKUP_STALL_TIMEOUT_SECONDS` marks the destination `unhealthy` (once; audited on the transition) and makes `/readyz` answer `503`. `/healthz` answers `503` only after the call has been stalled for another stall timeout, so Kubernetes restarts the pod. A call blocked on a `hard` mount cannot be cancelled; the restart is the recovery. While a call is stalled the worker also **stops extending the lease** of the item in flight and stops reporting `worker_seen_at` (so the UI shows no worker), aborts the item's source transfer, and pauses the destination's jobs as `destination_unhealthy`. The expired lease spends one attempt, as after any hard crash. `/readyz` is also `503` when PostgreSQL is unreachable or the schema is behind.

**Local development.** Point `BACKUP_DESTINATION_PATH` at a scratch directory with the mount check `none`, create a destination through `POST /backup-destinations` and put its id in `BACKUP_DESTINATION_ID`, then `POST /backup-destinations/:id/validate`. Integration tests (`pnpm test:int` in the app, same Postgres as `homelab-api`) run the real loop against a scratch directory. The image build and CI follow `video-worker`; CI finds the app through its `docker:publish`, `test:unit` and `test:int` scripts, and `scripts/docker-retag-prod.sh` lists it for the production retag.

## Copy engine

`apps/backup-worker/src/copy/`. Every step is safe to interrupt and repeat; the progress lives in `backup_entries`, the destination is only ever added to, and the one thing a killed attempt leaves behind (its staging files) is deleted when the next attempt starts.

**Claiming.** After validation each poll calls `claimAndCopyNext` (`copy/run.ts`), which first lets paused jobs resume (below), then claims, until there is nothing to claim or an item cannot be finished. An idle claim runs `completeBackupJobIfDone` for each drained job id (that is how a job becomes `completed`). While an item is copied, a timer keeps `worker_seen_at` fresh every `POLL_INTERVAL_MS` and a second timer (`copy/heartbeat.ts`) extends the lease every `BACKUP_HEARTBEAT_SECONDS`, including while a large file is hashed. A validation request made during a long copy waits for the item to end. A rejected heartbeat (job cancelled, lease expired) aborts the transfer and the item is left alone: nothing more is written or recorded.

**An item** (`copy/item.ts`):

1. Check that `<mount>/<root_dir>` has no symlink on the way and delete the item's leftover staging folder.
2. A **file item** has one entry with an empty `rel_path`. A **directory item** is listed once (`recurse ON; ls`, streamed) and every file and directory is upserted as a `pending` entry in batches of 500, with the root as `''`; entries inside a **carve-out** (a rejected nested item or an `exclude_subtree` rule) are skipped with their whole subtree. A subdirectory that cannot be listed becomes `failed` `unlistable`, or `not_followed` if `allinfo` shows the reparse bit. Then `enumeration_complete` is set. A retry lists again; nothing is duplicated.
3. Entries are processed 100 at a time, in id order, only the `pending` ones (a `verified` entry is trusted and never touched again). The page is described first with one batched `allinfo`, before any of it is read.
4. Directory entries are created (empty ones too). After all entries, the source modified time is set on every verified directory, deepest first, because writing children changes a directory's time.
5. Remove the item's staging folder (and `.exodus-staging` when empty), then settle the item.

**A file entry:**

1. **Metadata first**, from `allinfo`: creation, access, write and change times, attribute letters, alternate stream names and sizes; then, if there is a `Zone.Identifier` stream, its text (4 KiB at most). Written to the entry only if not recorded yet (first capture wins), so a retry never replaces the originals even though the first read moved the source's access time.
2. The destination path is `<source_dir_name>/<item dest_rel_path>/<rel_path>` with `\` as `/`; a name over 255 bytes is `name_too_long`; a path that resolves outside the source folder, or any symlink on the way, is `unsupported_path` and nothing is written.
3. Parent directories are created one component at a time with an `lstat` of each (checked once per directory per process). A file where a directory must be is `dest_conflict`.
4. The source is streamed into `.exodus-staging/<job item id>/<entry id>` while the SHA-256 is computed, then `fsync`ed. A stream shorter than the size `allinfo` reported is `read_failed` (a failing `smbclient` also is: see the gotcha below).
5. **Placing never clobbers.** If the final path is free, `link(staging, final)` (a lost race, `EEXIST`, looks at the path again). If it holds a regular file of the same size and the same SHA-256, it is **adopted** (and given the source modified time if it has another). If it holds anything else, the copy goes to `<stem>.exodus-<first 8 characters of the job id><ext>` in the same folder (`kept_both`); that name holding identical content is adopted too, different content is `dest_conflict`, and a directory in the way is `dest_conflict`. The old file is never touched.
6. Unlink the staging file, `utimes` the final file to the source modified time, read the destination back and compare the hash and size (`verify_mismatch` deletes only the file this attempt created).
7. Record the entry `verified` with `sha256`, `size_bytes` and `dest_rel_path` (the path actually written, relative to `<source_dir_name>/`, suffix included).

A junction or link (`allinfo` reparse bit) is recorded `not_followed` and left alone; it does not stop an item from being verified.

**Settling an item** (`copy/finish.ts`, plan §4.2 step 6): no failed entry means `completeBackupItem`. Otherwise `failBackupItem` with a summary of the failures: one non-transient issue (`source_missing`, `name_too_long`, `unsupported_path`, `dest_conflict`, `unlistable`) blocks the item at once; only `read_failed`, `write_failed` and `verify_mismatch` requeue it behind the backoff until its attempts are used up, then it is `failed`. An unreadable root (the file or directory is gone) is a failed `source_missing` or `unlistable` root entry and a blocked item. A retry re-lists and copies only what is missing.

**An item that does not settle** (`copy/run.ts`, `abandon()`):

| What happened                                                                                                         | What the worker does                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The lease is gone (cancelled or failed job, expiry)                                                                   | Leaves the item to the job, deletes its staging folder. Nothing more is written or recorded.                                                  |
| `SIGTERM`                                                                                                             | Aborts the transfer, deletes the staging folder, releases the item (attempt refunded). Verified entries stay verified.                        |
| The source stopped answering and a connection test fails                                                              | Releases the item (attempt refunded) and pauses the job as `source_unreachable`.                                                              |
| The source reported an outage but a connection test passes (a misleading error, such as a generic `NT_STATUS` status) | Fails the attempt as transient (the attempt counts, the error is kept). Otherwise such an item would cycle forever without spending attempts. |
| The destination as a whole is broken (see below), or a destination call stalled                                       | Releases the item (attempt refunded), marks the destination `unhealthy` and pauses its jobs as `destination_unhealthy`.                       |
| Anything else                                                                                                         | Fails the attempt as transient: retried behind the backoff, then `failed`.                                                                    |

A source read that stalls (no bytes for `BACKUP_STALL_TIMEOUT_SECONDS`, the `smbclient` child is killed) is not an outage: it is a transient `read_failed` entry. If the source really is down, the next entry hits `unreachable` and the job pauses.

**Writing to the destination.** Every call (`lstat`, `mkdir`, `open`, each `write`, `fsync`, `link`, `utimes`, each read of the hash pass) runs under the `DestinationWatchdog` on its own, not the whole file: a 500 MB file legitimately takes minutes, one write that takes minutes means a hung mount. Failures of the filesystem carry their errno and are classified by what they say about the destination (`copy/dest-fs.ts`):

- `EIO`, `ESTALE`, `ENOTCONN`, `ENOSPC`, `EDQUOT`, `EROFS` anywhere, `EACCES`/`EPERM` on the mount, the `root_dir`, the source folder's own directory or the staging area, and a missing mount point: `DestinationUnhealthyError`, handled as in the table above.
- Anything else, `EACCES` under the source folder included: `DestWriteError`, a `write_failed` entry of that file only.

Before each item the worker also checks that the mount point still is the destination's NFS export (`/proc/mounts`, skipped with the mount check `none`), so a lost mount cannot make it write into the container's own filesystem.

**Source access** (`packages/source-access`, [README](../../packages/source-access/README.md)). Findings of the M4 spike that shape the code (numbers in the [plan](./backup-design/plan.md#10-spike-results)):

- Large file: 2.0 to 2.2 MB/s from the dev container (547 MB in about 4.5 minutes), network-bound.
- Per-file `get` is about 100 ms: no batched `get` or tar. `allinfo` is batched, 100 paths and at most 64 KB of commands per `smbclient` session.
- `ls` shows no junctions at all and cannot flag reparse points; the reparse bit (`0x400`) is in the hex attributes of `allinfo`.
- `get ... -` prints its errors on **stdout**, in the data stream, and exits 1. The driver turns a non-zero exit into a `ConnectionError` on the stream; a consumer must not trust bytes read before that.
- The account needs a share for a path: `C$` is denied for `alpha-centauri`, and the source only maps `C:\Users`. **`C:\backup-test\...` needs a mapping such as `C:\` to `C` before the first real run.**

## Pauses and shutdown

A **pause** is `backup_jobs.stalled_reason` (the job stays `running`). Claims of a paused job answer `source_unreachable` or `destination_unhealthy` and spend no attempts. Each pause writes one `backup_job.stalled` audit event and the end of it one `backup_job.resumed`; repeats write none.

- **`source_unreachable`** pauses one job. After its wait is over the worker asks the source (a connection test) at the start of each claim: an answer resumes the job, silence waits longer.
- **`destination_unhealthy`** pauses every active job of the destination and marks it `unhealthy` (one `backup_destination.unhealthy` event). A passing validation resumes them.
- **Backoff** is in memory (`copy/pause-tracker.ts`): 30 s, doubling, capped at 5 minutes, per source job and for the destination. It resets only when an item has been worked through, not when a probe passes, so a cause that comes and goes slows down instead of writing a stalled/resumed pair every 30 s. After a restart the first check is immediate.

**`SIGTERM`** (`worker/shutdown.ts`): the poll loop stops, the shutdown signal aborts the transfer in flight (it is part of the item's abort signal, together with the heartbeat's and the watchdog's), the staging folder is deleted and the item is released with the attempt refunded. The process exits after at most 30 s even if a destination call is stuck (the pod's grace period is 60 s); the lease then expires and spends one attempt. A hard kill spends one attempt, and the next attempt resumes from `backup_entries`.

**Human actions** (API, M2) end to end: _retry_ grants a `failed` or `blocked` item exactly one more attempt and only while the job is active; _retry-failed_ does that for every such item; _cancel_ and _fail_ release the leases, so a late heartbeat, complete, fail or release of the worker is rejected with a conflict and the worker deletes the item's staging folder when its next heartbeat notices; _rerun-unresolved_ plans a new job from the failed and blocked items of a finished job (anything verified since is skipped, and files already on the destination are adopted, not rewritten). One batched `backup_job_items.lease_expired` event per expiry check carries the job, source and destination ids, the number of items, how many of them failed, and some item ids.

## Parallelism and memory

`BACKUP_PARALLELISM` (default 1) is how many entries of an item are copied at once: a pool within each page of 100 entries (`copy/pool.ts`), after the page's batched `allinfo`. The first entry that cannot go on (source gone, destination broken, shutdown) aborts the ones beside it. Each running copy is one `smbclient` child, so this is also the number of children.

**Memory** (measured 2026-10-28, from the dev container, scratch destination, no NFS mount available there):

| Run                                                     | Node RSS (idle → peak) | `smbclient` children       |
| ------------------------------------------------------- | ---------------------- | -------------------------- |
| M4: one 547 MB zip from the real source, N=1            | 80 → 117 MiB           | 33 MiB (1 child)           |
| 6 × 48 MiB files from `FakeDriver`, N=1 / 2 / 4         | 85 → 105 / 105 / 108   | none                       |
| Real source, `ZeldaClone` (354 files, 5 MiB, 19 s), N=4 | 87 → 131 MiB           | 4 at once, 71 MiB combined |

Node's own memory barely moves with N (about 1 MiB per parallel file: stream and 1 MiB hash buffer); the cost is the children, about 33 MiB each when streaming a large file. **N=1 is about 150 MiB, N=2 about 180 MiB, N=4 about 250 MiB**, plus reclaimable page cache from the NFS writes that Kubernetes still counts. The 256Mi limit in home-kubernetes#27 holds for the default of 1 with about 100 MiB to spare; **N of 3 or more needs a bigger limit (384Mi for N=4)**. The real NFS mount is not measured (the dev container cannot mount): watch `container_memory_working_set_bytes` in the first real run.

## Gotchas

- `drizzle.config.ts` lists schema files explicitly: a new schema file must be added there or `drizzle-kit generate` silently leaves its tables out.
- The apps compile `homelab-db` and `source-access` from `src/` without `strictNullChecks`; `homelab-api` compiles `homelab-db` from `src/` without `strictNullChecks`, so a union discriminated on `item: null` does not narrow there. Use an `in` check (`'job' in result`).
- `homelab-db` is compiled without `strictNullChecks` in the apps, so `{ ok: false } | { ok: true }` unions do not narrow on `ok` either (`checkNfsMount` is narrowed with `'message' in result`).
- `smbclient ... get "path" -` reports a missing file, access denied or a dropped connection as text on stdout with exit code 1, never on stderr. Only the exit code tells data from an error.
- Item responses are built without `claim_token` (`toItemView` in `services/backup/jobs.ts`), unlike discovery's queue item listings.
