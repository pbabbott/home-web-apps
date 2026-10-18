# Exodus - Data Model

[← Project Exodus](./README.md)

Four tables. The split that matters: a **job** is one run over a source and owns the lifecycle; a **queue item** is one directory to explore _within that job_ and tracks only its own unit of work; an **inventory item** is a file or directory found, and outlives any one job.

- **`sources`** — a machine being inventoried: `name` (unique), `source_type` (only `windows` today), and an optional `host_id` that references `hosts.id`, so a source can be joined to the registered host for its name and IP. Sources need not be linked to a host. The foreign key is `ON DELETE RESTRICT`: deleting a host that still has a source returns 409 instead of silently wiping its discovery history.
- **`discovery_jobs`** — one run over a source, rooted at `root_path`. Status: `pending` → `running` → `completed` | `failed` | `cancelled`. A partial unique index allows only **one active (pending/running) job per source**.
- **`discovery_queue_items`** — one directory to explore within a job. Status: `queued` → `in_progress` → `completed` | `skipped` | `failed`. `job_id` is required and cascades on delete; unique on `(job_id, normalized_path)`. The source is reached through the job. Fields: `priority` (higher claimed first), `attempt_count`, `max_attempts` (default 3), `last_error`, `available_at` (retry backoff), and the lease (`claimed_by`, `claim_token`, `lease_expires_at`). No job-level lifecycle is duplicated on items.
- **`inventory_items`** — a file or directory found while exploring a source. Unique on `(source_id, normalized_path)` (lowercased, so Windows paths match case-insensitively). Fields: `item_type` (`file` | `directory`), `path`, `parent_path` (null only for roots), `name`, `extension` (lowercased, files only), `size_bytes` (bigint), `modified_at`, `first_job_id` / `last_job_id` (set null if a job is deleted) and `first_seen_at` / `last_seen_at`.

**State checks.** `discovery_queue_items` has `CHECK`s that `0 <= attempt_count <= max_attempts` and that an `in_progress` item has `claimed_by`, `claim_token` and `lease_expires_at` all set; `inventory_items` checks `size_bytes >= 0`. The queries already keep to these, so the database now rejects an illegal state instead of storing it.

Migration history: `0003` created the tables with a `hostname` text column, `0004` replaced it with a required `host_id`, `0005` made `host_id` optional, `0006` scoped the queue to its job (see Decisions) and added `inventory_items`, `0007` added the `CHECK` constraints above, and `0008` renamed `backup_sources` to `sources` (the enum, the table and its constraints, all in place, so no data moved).
