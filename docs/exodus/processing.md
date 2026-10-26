# Exodus - How Processing Works

[← Project Exodus](./README.md)

## Claiming and leases

`POST /discovery-jobs/:id/queue-items/claim` atomically leases the highest-priority eligible item. The whole claim is one transaction that locks the job row (so claimers are serialized per job and a concurrent cancel cannot interleave) and picks the item with `FOR UPDATE SKIP LOCKED`, so concurrent workers never receive the same row. The response includes a `claimToken`; every later call on the item (`heartbeat`, `complete`, `fail`, `skip`) must send it, and each is rejected with 409 if the token is wrong, the lease has expired, **or the job is no longer active**.

The lease defaults to 5 minutes (max 1 hour) and `heartbeat` extends it. If the agent crashes, the item stays `in_progress` until the lease expires. The next claim (or job completion check) first returns expired items to `queued`, so abandoned work is reclaimed and nothing stays stuck. Each abandoned claim spends its attempt; `attempt_count`, `last_claimed_by` and a `last_error` naming the worker and attempt are kept for debugging. An expired item that has used all its attempts becomes `failed` instead (`lease expired on final attempt …`). Expiry is lazy (it runs on claim and on the job completion check), so home-hud flags an in-progress item whose lease has passed as `expired` until the next claim reclaims it.

A worker that must stop early calls `POST /queue-items/:id/release`: the item returns to `queued` at once and the attempt is refunded. `POST /queue-items/claim` claims across active jobs (see the API doc) and `claim`/`complete`/`skip` results carry the job's remaining counts, so a bounded run knows when to stop. `complete` and `skip` repeated with the same `claimToken` answer from the settled item instead of conflicting; proposals were already idempotent.

Claiming only considers the claiming job's own items. The first claim on a pending job moves it to `running`. The claim always answers 200 with `{ item }`. When nothing is claimable, `item` is `null` and the response says why, so the worker loop knows whether to stop or wait:

| `reason`        | Meaning                                                                 | `retryAt`                   |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| `queue_empty`   | Nothing queued or in progress: call `POST /discovery-jobs/:id/complete` | `null`                      |
| `retry_backoff` | Queued items are waiting out a retry delay                              | earliest `available_at`     |
| `in_progress`   | Only other workers' leases remain                                       | earliest `lease_expires_at` |

The idle response also carries the job's `queueCounts`. Claiming on a finished job is 409.

## Exploring selectively

`POST /queue-items/:id/complete` takes `discoveredPaths` — follow-up directories that need more investigation, each a plain path or `{ path, reason?, priority? }`. It is **not** a list of every child: queue only promising paths, and never the inside of a project already turned into an inventory item. It also takes an optional `summary`, `skipped: [{ path, reason }]` (paths inside the claimed directory that were seen and deliberately not explored) and `skippedGroups: [{ pattern, count?, reason }]` (many similar direct entries skipped by name pattern, e.g. `*.msi`; non-recursive), stored as the item's `result`. It also takes `unreadable: [{ path, error }]`: child directories the agent could not list (access denied, `EPERM`). Each is recorded **at once as a `failed` item** in the same transaction, with no claim and no attempt spent, and listed in the parent's `result.unreadable`; a human can retry it once access is granted. A big directory outlives the 5-minute lease unless the worker calls `heartbeat`; after a crash the next claim of the directory should start from `list_inventory_items` for that path, since proposals are idempotent. The completion and the enqueue happen in **one transaction**, so a crash cannot complete a directory while losing the follow-ups. Every path must lie inside the job's root. Enqueuing a path that is already queued is a no-op, reported with `created: false`. Follow-ups under an `exclude_subtree` rule come back already `skipped`; claims recheck in case rules change later.

## Failures and retries

`POST /queue-items/:id/fail` records the error. A retryable failure with attempts left returns the item to `queued` behind an exponential backoff (30s, 60s, 120s, … capped at 1 hour). Access denied does not fix itself, so the agent reports a claimed directory it cannot read with `retryable: false`; `retryable: true` is for transient errors (busy, locked, network). Otherwise — `retryable: false`, or attempts exhausted — the item becomes `failed` and stays visible. A human can then use `POST /queue-items/:id/retry`, which grants **exactly one more attempt** (`max_attempts = attempt_count + 1`) while keeping the attempt count and last error, so a still-broken directory cannot loop forever. Retry clears the claim fields, refuses anything that is not `failed` (including an item being worked on), and **only works while the item's job is pending or running**: a failed item of a finished job can only be explored again by starting a new job.

Retrying is therefore both automatic (retryable failures with attempts left, behind a backoff) and manual (one extra attempt per human request). An attempt is counted when a claim starts, so a crash that loses the lease uses one.

## Finishing a job

`POST /discovery-jobs/:id/complete` succeeds once nothing is `queued` or `in_progress`, after reclaiming expired leases. A retry that is still waiting out its backoff counts as `queued`, so it blocks completion. A permanently `failed` item does **not** block completion: the job finishes "with failures", reported as `queueCounts.failed` on the job. Otherwise the call returns 409 with the blocking `queueCounts`. Terminal jobs reject further complete/cancel/fail, enqueue and claim with 409.

`cancel` and `fail` also **release the job's leases** in the same transaction: in-progress items go back to `queued` with no claim and `last_error = 'job cancelled'` (or `'job failed'`). A worker still holding one is rejected with 409 on its next call (`heartbeat`, `complete`, `fail`, `skip` and `inventory-items` all require an active job), so it cannot add children or inventory items to a finished job. Queued and failed items are left alone as a record of what was never explored.

Completing, cancelling, failing, claiming and enqueueing all take the job row lock, so they cannot interleave: an enqueue either lands before a completion (which then refuses to finish over the new work) or waits and is rejected.

## Paths

Windows paths are normalized to single backslashes with no trailing separator (a drive root keeps its `\`), with an uppercase drive letter for display. The `normalized_path` used for deduplication and comparison is the lowercased form, so `C:\Users\You` and `c:/users/you/` are the same directory. Comparison respects directory boundaries: `C:\Users\You` contains `C:\Users\You\Docs` but not `C:\Users\YouOther`. Only absolute `X:\…` and UNC `\\server\share\…` paths are accepted; relative paths, `.`/`..` segments, `\\?\` prefixes and characters Windows disallows are rejected with 400.
