# Exodus - Decisions and Learnings

[← Project Exodus](./README.md)

## Decisions and gotchas worth knowing

- **Inventory was removed (migration `0011`).** Once review candidates existed, `inventory_items` had no reader: the agent was told not to catalogue, the copy workflow takes its scope from approved candidates, and the one automatic write (the job root) only fed the inventory browser. The table, its routes, the `record_discovered_items` tool, the home-hud page and the audit `inventory_item_id` column were dropped, the legacy `inventory_item.review_*` audit events were deleted, and the `inventory_item_type` enum became `candidate_kind` because candidates still use it. Reviewed rows had already moved to candidates in `0010`. If per-object metadata is ever needed again, it should come from the copy job or the agent's own filesystem access, not stored rows.
- **"Everything beneath it" filters the folder itself out on the page, not in the API.** The API's path-prefix filter includes the prefix path itself, so a full page can show 99 rows. The next-page decision uses the raw row count, so a short page never hides the Next link.
- **The queue belongs to the job.** Each job explores from its own root with its own items, counts and completion check, so `queueCounts` describe that job exactly. What earlier jobs found is not lost: it lives in `review_candidates`, which are keyed by source and updated on rediscovery. (Migration `0006` replaced an earlier source-wide queue where a new job inherited a cancelled job's leftovers.)
- **No UI for failing a job by hand.** `POST /discovery-jobs/:id/fail` exists as a REST route (it is not an MCP tool, so the agent cannot call it); the UI offers Complete and Cancel only.
- **Retry is human-only (REST), not an MCP tool.** `POST /queue-items/:id/retry` takes no `claimToken`, so exposing it would let any MCP client requeue any failed item, and retry is meant to be one extra attempt per human request. The `retry_directory` tool was dropped (issue #216).
- **Known small risks:** `claimToken` is visible in queue item listings, and there is no authentication, including on `/mcp`.
- **Server actions return results instead of throwing.** Next.js redacts the message of an error thrown from a server action in production builds, and the API's messages ("already exists", "still has queued work (1 in progress)") are meant to be shown.
- **`fui-components` cannot be imported from a Server Component** — its bundle uses hooks. Pages that need to render an error state hand it to a small client component (`SourceLoadError`).
- **`drizzle-kit generate` prompts interactively** when a column is added next to a dropped one, or when a table or enum disappears next to a new one ("created or renamed?"). It needs a TTY; the migration 0004 and 0005 files were generated under a pseudo-terminal accepting the default. For a rename, the default answer is "create", which generates a drop plus a create and would lose the data: pick "rename" (Down, Enter) at each prompt. Even then it renames the table but drops and re-adds the constraints; `0008` replaces those with `RENAME CONSTRAINT` statements, which keep the same end state without re-validating every row. The snapshot drizzle writes describes the new schema regardless, so only the SQL needs hand-editing. The generated `meta/*.json` files must also pass Prettier or the pre-commit hook rejects the commit.

## Learnings

Things that were not obvious while building the job-scoped queue and its stored results (including the since-removed inventory). Most are about Postgres, Drizzle or the test setup, and would otherwise be rediscovered the hard way.

### Modelling

- **Keep job and queue item separate.** A job is a user-requested run and owns the lifecycle; a queue item is one directory within that job and tracks only its own work. The first design made the queue source-wide (nullable `job_id` meaning "last job that touched it", dedupe per source, claims re-stamping items). That blurred the boundary and made `queueCounts` describe the source rather than the job, so it was replaced. Anything that must be remembered across jobs belongs in review candidates, keyed by source.
- **Derive instead of duplicating.** Queue items dropped `source_id` because the job already knows it. Queries that filter by source join through `discovery_jobs`.
- **Identity vs. display.** Every path-bearing table stores `path` (as typed, drive letter uppercased) next to `normalized_path` (lowercased). Dedupe uses the normalized column. Rediscovery overwrites the display form, so `c:/users/you/REPORT.PDF` after `Report.pdf` shows `C:\users\you\REPORT.PDF` on the same row.
- **Overwrite only what you own.** The candidate upsert lists only the agent-owned columns it updates; the human `decision*` columns are never in a `set`, so rediscovery cannot reset a decision. Adding a decision column to a `set` list would be the bug.
- **`first_*` / `last_*` instead of one `job_id`.** `first_job_id` and `last_job_id` answer "who found this" and "who last saw this" separately; `first_seen_at` and `last_seen_at` do the same for time. Both job columns are `SET NULL` so deleting a job never deletes candidates.
- **Take ownership from the claim, not the request.** Proposing candidates looks up the source and job from the claimed queue item. A client cannot write into another source's candidates even if it sends `sourceId` in the body (the field is ignored).

### Postgres and Drizzle

- **`ON CONFLICT DO UPDATE` cannot hit the same row twice in one statement** ("cannot affect row a second time"). The batch is deduplicated by normalized path first, last occurrence winning.
- **Telling inserts from updates:** `returning (xmax = 0)` is true for a freshly inserted row and false for an updated one, so the upsert reports `created` in one round trip. It relies on Postgres internals but is a well-known idiom.
- **Drizzle `returning()` takes columns, not a table.** To add a computed column next to a whole row, spread `getTableColumns(table)` and add the `sql` expression beside it.
- **`bigint` needs `{ mode: 'number' }`** or Drizzle returns strings. Safe up to 2^53, which is why the API caps `sizeBytes` at `Number.MAX_SAFE_INTEGER`. A 32-bit `integer` would break on files over 2 GB.
- **LIKE prefixes must be escaped.** `_` and `%` in a path are wildcards, so `my_dir` would also match `myXdir`. The prefix filter escapes `!`, `%` and `_` and uses `escape '!'`.
- **Ordering and keyset paging share the database collation.** Listing orders by `normalized_path` and the `after` cursor compares with `>` on the same column, so paging is consistent. It does not match JavaScript's `sort()` (`_` vs `X` differ), so tests must not compare against a JS sort.
- **Generating a destructive migration:** `drizzle-kit generate --name <name>` worked under `script -qec "pnpm db:generate --name x" /dev/null` (a pseudo-terminal). It orders the statements itself (drop constraint, drop index, `SET NOT NULL`, add constraint), but it does not know about data. Hand-edit the SQL to clean rows first, as `0006` does with `DELETE ... WHERE job_id IS NULL` before `SET NOT NULL`.
- **Migrations apply on startup**, including to the shared local dev database, so a destructive migration runs against whatever is in `pnpm dev:deps` the next time the API or the integration tests start.

### Concurrency and locking

- **Overlapping multi-row upserts deadlock unless they lock in the same order.** Two workers writing overlapping batches in opposite orders hit `deadlock detected` (found with the since-removed inventory upsert: HTTP 500, 11 of 40 probe requests). Candidate batches are written in normalized-path order, so every transaction locks rows in the same order.
- **Take the job row lock first, then item rows.** `claim`, `complete job`, `enqueue`, and `complete item` all lock the job row before touching items (claim, complete-job: `FOR NO KEY UPDATE`; enqueue, complete-item: `FOR SHARE`), and `cancel`/`fail` get the same lock from their `UPDATE`. One lock order means no deadlock between them, and it closes two races found by probing: a cancel interleaving with a claim (leaving an item in progress on a cancelled job, or resurrecting the job to `running`) and a completion interleaving with an enqueue (leaving queued work on a completed job).
- **Do not combine `FOR SHARE` with an update of the same row in the same transaction across many workers.** Two claimers each holding a share lock and each wanting to update the job to `running` would deadlock, which is why claim uses `FOR NO KEY UPDATE` (self-conflicting, so claimers queue up) instead. `FOR NO KEY UPDATE` also does not block the foreign-key check that inserting queue items does against the job row, where plain `FOR UPDATE` would.
- **A guard in the `WHERE` beats a check-then-write.** Every item mutation goes through `activeClaim`, which includes `exists (select 1 from discovery_jobs … status in ('pending','running'))`, so job status, token, state and lease are all verified by the same statement that writes. Retry uses the same job guard.
- **Probe races against the live API.** Four of the six review concerns were real bugs that the unit tests could not see. Each reproduced with a short script firing concurrent requests at the running API (deadlock, late worker after cancel, retry on a finished job, complete vs enqueue). Turn each into an integration test and check it fails without the fix.

### HTTP and API

- **The body limit is 100 kb.** `configureBaseServerMiddleware` uses `json()` with the Node default, so a body that is too large becomes a 413 that this API surfaces as a 500. Candidate batches are capped at 10. The existing `POST /discovery-jobs/:id/queue-items` allows 1000 paths and could hit the same limit with long paths.
- **A claim with nothing to give is still `200`.** A bare `204` could not tell a worker to stop from a worker to wait. The body carries `reason`, `retryAt` and the job's `queueCounts`; success is `{ item }`.
- **A path must lie inside the claimed directory** (strictly, not the directory itself) to be recorded. Rejecting the whole batch with 409 and listing the offending paths keeps a buggy worker from half-recording a directory.
- **Duplicate OpenAPI keys fail the typecheck.** A path object can only appear once in `openapi.ts`; adding `get` to a path that already has `post` means merging into the existing entry.

### Testing

- **Mocked-route unit tests need every new service function in the `jest.mock` factory** in `tests/unit/discovery.unit.test.ts`, or the route throws on an undefined function.
- **The integration suite runs against the real dev database** and deletes what it creates by deleting sources (jobs, queue items and candidates cascade). A test that creates data another way must clean it up itself.
- **Simulate time by editing rows.** Lease expiry and retry backoff are tested by updating `lease_expires_at` / `available_at` directly rather than sleeping.
- **Prove "does not reset" by backdating.** To check that `first_seen_at` survives rediscovery, backdate it first; otherwise a reset to `now()` is indistinguishable from the original.
- **Rebuild `homelab-db` after changing it** (`pnpm build`), because `homelab-api` runs against `dist/`, including under Jest.
