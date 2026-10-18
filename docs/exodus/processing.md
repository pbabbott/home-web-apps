# Exodus - How Processing Works

[← Project Exodus](./README.md)

## Claiming and leases

`POST /discovery-jobs/:id/queue-items/claim` atomically leases the highest-priority eligible item. The whole claim is one transaction that locks the job row (so claimers are serialized per job and a concurrent cancel cannot interleave) and picks the item with `FOR UPDATE SKIP LOCKED`, so concurrent workers never receive the same row. The response includes a `claimToken`; every later call on the item (`heartbeat`, `complete`, `fail`, `skip`, `inventory-items`) must send it, and each is rejected with 409 if the token is wrong, the lease has expired, **or the job is no longer active**.

The lease defaults to 5 minutes (max 1 hour) and `heartbeat` extends it. If the agent crashes, the item stays `in_progress` until the lease expires. The next claim (or job completion check) first returns expired items to `queued`, so abandoned work is reclaimed and nothing stays stuck. `attempt_count` and `last_error` are kept for debugging. An expired item that has used all its attempts becomes `failed` instead.

Claiming only considers the claiming job's own items. The first claim on a pending job moves it to `running`. The claim always answers 200 with `{ item }`. When nothing is claimable, `item` is `null` and the response says why, so the worker loop knows whether to stop or wait:

| `reason`        | Meaning                                                                 | `retryAt`                   |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| `queue_empty`   | Nothing queued or in progress: call `POST /discovery-jobs/:id/complete` | `null`                      |
| `retry_backoff` | Queued items are waiting out a retry delay                              | earliest `available_at`     |
| `in_progress`   | Only other workers' leases remain                                       | earliest `lease_expires_at` |

The idle response also carries the job's `queueCounts`. Claiming on a finished job is 409.

## Exploring incrementally

`POST /queue-items/:id/complete` takes `discoveredPaths` — the child directories found inside the one just inspected. The completion and the enqueue of the children happen in **one transaction**, so a crash cannot complete a directory while losing the subdirectories it found. Every path must lie inside the job's root. Enqueuing a path that is already queued is a no-op, reported with `created: false`.

## Recording inventory

Creating a job also records its **root as an inventory directory** (same transaction). A worker only records what lies beneath the directory it holds, so without this the root itself could never be reviewed or marked later.

`POST /queue-items/:id/inventory-items` takes the claim token and up to 200 `{ path, itemType, sizeBytes?, modifiedAt? }` entries found inside the claimed directory (descendants are allowed, the directory itself is not; anything else is 409 and nothing is recorded). The source and job come from the claim, never from the request. Recording is an upsert on source + normalized path:

- Rediscovery by a retry, a reclaimed lease or a later job updates the same row (filesystem facts, `last_job_id`, `last_seen_at`). `id`, `first_job_id`, `first_seen_at` and `created_at` never change, and columns added later for review or copy state are not in the update, so they survive.
- A missing `sizeBytes` or `modifiedAt` keeps the stored value rather than clearing it.
- Because it is separate from `complete`, items recorded before a crash stay; the next worker repeats the call without creating duplicates.

`GET /sources/:id/inventory-items` lists by `jobId` (last seen), `itemType`, `parentPath` (direct children) or `pathPrefix`, ordered by normalized path with a keyset cursor (`after`, `limit` up to 1000).

## Failures and retries

`POST /queue-items/:id/fail` records the error. A retryable failure with attempts left returns the item to `queued` behind an exponential backoff (30s, 60s, 120s, … capped at 1 hour). Otherwise — `retryable: false`, or attempts exhausted — the item becomes `failed` and stays visible. A human can then use `POST /queue-items/:id/retry`, which grants **exactly one more attempt** (`max_attempts = attempt_count + 1`) while keeping the attempt count and last error, so a still-broken directory cannot loop forever. Retry clears the claim fields, refuses anything that is not `failed` (including an item being worked on), and **only works while the item's job is pending or running**: a failed item of a finished job can only be explored again by starting a new job.

Retrying is therefore both automatic (retryable failures with attempts left, behind a backoff) and manual (one extra attempt per human request). An attempt is counted when a claim starts, so a crash that loses the lease uses one.

## Finishing a job

`POST /discovery-jobs/:id/complete` succeeds once nothing is `queued` or `in_progress`, after reclaiming expired leases. A retry that is still waiting out its backoff counts as `queued`, so it blocks completion. A permanently `failed` item does **not** block completion: the job finishes "with failures", reported as `queueCounts.failed` on the job. Otherwise the call returns 409 with the blocking `queueCounts`. Terminal jobs reject further complete/cancel/fail, enqueue and claim with 409.

`cancel` and `fail` also **release the job's leases** in the same transaction: in-progress items go back to `queued` with no claim and `last_error = 'job cancelled'` (or `'job failed'`). A worker still holding one is rejected with 409 on its next call (`heartbeat`, `complete`, `fail`, `skip` and `inventory-items` all require an active job), so it cannot add children or inventory to a finished job. Queued and failed items are left alone as a record of what was never explored.

Completing, cancelling, failing, claiming and enqueueing all take the job row lock, so they cannot interleave: an enqueue either lands before a completion (which then refuses to finish over the new work) or waits and is rejected.

## Paths

Windows paths are normalized to single backslashes with no trailing separator (a drive root keeps its `\`), with an uppercase drive letter for display. The `normalized_path` used for deduplication and comparison is the lowercased form, so `C:\Users\You` and `c:/users/you/` are the same directory. Comparison respects directory boundaries: `C:\Users\You` contains `C:\Users\You\Docs` but not `C:\Users\YouOther`. Only absolute `X:\…` and UNC `\\server\share\…` paths are accepted; relative paths, `.`/`..` segments, `\\?\` prefixes and characters Windows disallows are rejected with 400.
