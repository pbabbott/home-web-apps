# Exodus Backup: what is built

[← Project Exodus](./README.md)

Copying approved inventory to an NFS destination. The design and the remaining milestones are in [backup-design](./backup-design/README.md); this page describes only what exists.

**Built so far:** the data model and the queries in `packages/homelab-db` (milestone M1, migration `0016_backup`), and the shared SMB package `packages/source-access` (M0). There are no API routes and no worker yet.

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
- **Coverage** (`getBackupCoverage`) has no table: it derives one bucket per inventory item for a (source, destination) from job items and entries and reports `allAccounted`. `undecided`, `pending`, `failed`, `blocked` and `never_attempted` block it. `never_attempted` also holds approved items whose jobs ended without trying them (a cancelled job leaves them `queued`). Verified data is never deleted, so a later failure does not revoke `covered`; `latestAttempt` shows the newest job item beside it. Discovery review status is not included yet (display only; it belongs to the API milestone).

## Gotchas

- `drizzle.config.ts` lists schema files explicitly: a new schema file must be added there or `drizzle-kit generate` silently leaves its tables out.
- `homelab-api` compiles `homelab-db` from `src/` without `strictNullChecks`, so a union discriminated on `item: null` does not narrow there. Use an `in` check (`'job' in result`).
