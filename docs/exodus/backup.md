# Exodus Backup: what is built

[← Project Exodus](./README.md)

Copying approved inventory to an NFS destination. The design and the remaining milestones are in [backup-design](./backup-design/README.md); this page describes only what exists.

**Built so far:** the data model and the queries in `packages/homelab-db` (milestone M1, migration `0016_backup`), the shared SMB package `packages/source-access` (M0), the REST API in `apps/homelab-api` (M2), and the worker scaffold with destination validation in `apps/backup-worker` (M3). The worker does not copy yet, so a created job waits for the copy engine; there is no UI.

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

`apps/backup-worker` ([README](../../apps/backup-worker/README.md)) is modelled on `video-worker`: an Express server plus a poll loop, migrations at startup under the advisory lock, the image built with `samba-client`. **One worker serves one destination** (`BACKUP_DESTINATION_ID`). It calls `homelab-db` queries directly and has no routes besides `GET /healthz` and `GET /readyz`. It does not claim or copy anything yet: `claimNextBackupItem` is not called, so a created job stays `planned`.

**Configuration** (environment; defaults in `src/config.ts`, example in `sample.env`):

| Variable                                                                 | Default          | Purpose                                                                                           |
| ------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| `POSTGRES_HOST/PORT/DATABASE/USER/PASSWORD`                              | as the API       | The shared `homelab_api` database                                                                 |
| `EXODUS_CREDENTIAL_KEY`                                                  | required         | 32 bytes, base64; the same value as `homelab-api`. Checked at startup, used by the copy engine    |
| `BACKUP_DESTINATION_ID`                                                  | required         | UUID of the destination this worker serves                                                        |
| `BACKUP_DESTINATION_PATH`                                                | required         | Absolute container path of the mounted export. Existence is checked by validation, not at startup |
| `BACKUP_DESTINATION_MOUNT_CHECK`                                         | `nfs`            | `none` for local development only; the result then has `mountVerified: false`                     |
| `BACKUP_STALL_TIMEOUT_SECONDS`                                           | `120`            | No-progress timeout for destination calls (the watchdog)                                          |
| `POLL_INTERVAL_MS`                                                       | `5000`           | Poll interval; the API treats a worker as stale after 2 minutes (`WORKER_STALE_AFTER_MS`)         |
| `BACKUP_PARALLELISM`, `BACKUP_HEARTBEAT_SECONDS`, `BACKUP_LEASE_SECONDS` | `1`, `60`, `300` | Read and validated, not used until the copy engine                                                |

**Poll loop.** Every poll calls `touchBackupDestinationWorker` (`worker_seen_at`). The worker validates its destination on the first poll and whenever `validation_requested_at` is set, then stores the result with `recordBackupDestinationValidation`, which sets `health` (`ok` or `unhealthy`), `last_validated_at` and `last_validation`, clears the request, and writes the `validated` or `unhealthy` audit event. A request made while it validates is cleared too. A missing destination row or a database error is logged and the loop carries on.

**Validation** (`src/destination/validate.ts`; `/proc/mounts`, the filesystem, the clock and the random id are injected). Checks run in order and stop at the first fatal one:

1. `mount`: `BACKUP_DESTINATION_PATH` is a mount point whose entry is `nfs` or `nfs4` with device `settings.server:exportPath`. Skipped with the check set to `none`; `mountVerified` is then `false`.
2. `root`: the mount path is a directory; `<mount>/<root_dir>` stays inside the mount, has no symlink in any existing component (`lstat`), and is created if missing.
3. `probe`: in a transient `.exodus-probe-<random>/` folder under the root: write, `fsync`, read back and compare a SHA-256; `link()` and a second `link()` onto the same name that must fail with `EEXIST`; `rename`; `utimes` and a `stat` round trip; a 255-byte name; a case-variant pair; names with spaces, a trailing dot and non-ASCII. The folder is removed in a `finally`; a removal failure is its own failed check (`probe_cleanup`). Nothing else is written.

`last_validation` holds `ok`, `mountVerified`, `checks` (`{ name, ok, message }`), `findings` and `rootEntries`. Findings: `mountPath`, `checkedAt`, `mount` (device, type, options), `utimesSupported`, `maxNameLength`, `rejects256ByteName`, `caseSensitive`, `uid`, `gid`, `freeBytes`, `totalBytes` (information only; a failed `statfs` is `statfsError`), and `rootEntriesTruncated` (the real count) when the listing was cut.

**`rootEntries`** are the names directly under `<mount>/<root_dir>`, sorted, listed read-only before the probe writes, capped at 1000, without `.exodus-probe-*` and `.exodus-staging`. The API's plan warning (`destination_folder_exists` / `destination_folder_unknown`) reads it; before a validation has run there is none.

**Watchdog and probes.** Every destination call (the whole validation today; copy I/O later) runs under `DestinationWatchdog`. A call that has not returned after `BACKUP_STALL_TIMEOUT_SECONDS` marks the destination `unhealthy` (once; audited on the transition) and makes `/readyz` answer `503`. `/healthz` answers `503` only after the call has been stalled for another stall timeout, so Kubernetes restarts the pod. A call blocked on a `hard` mount cannot be cancelled; the restart is the recovery. The part that stops heartbeating a leased item arrives with the claim loop (M5). `/readyz` is also `503` when PostgreSQL is unreachable or the schema is behind.

**Local development.** Point `BACKUP_DESTINATION_PATH` at a scratch directory with the mount check `none`, create a destination through `POST /backup-destinations` and put its id in `BACKUP_DESTINATION_ID`, then `POST /backup-destinations/:id/validate`. Integration tests (`pnpm test:int` in the app, same Postgres as `homelab-api`) run the real loop against a scratch directory. The image build and CI follow `video-worker`; CI finds the app through its `docker:publish`, `test:unit` and `test:int` scripts, and `scripts/docker-retag-prod.sh` lists it for the production retag.

## Gotchas

- `drizzle.config.ts` lists schema files explicitly: a new schema file must be added there or `drizzle-kit generate` silently leaves its tables out.
- `homelab-api` compiles `homelab-db` from `src/` without `strictNullChecks`, so a union discriminated on `item: null` does not narrow there. Use an `in` check (`'job' in result`).
- `homelab-db` is compiled without `strictNullChecks` in the apps, so `{ ok: false } | { ok: true }` unions do not narrow on `ok` either (`checkNfsMount` is narrowed with `'message' in result`).
- Item responses are built without `claim_token` (`toItemView` in `services/backup/jobs.ts`), unlike discovery's queue item listings.
