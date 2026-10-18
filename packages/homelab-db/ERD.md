# homelab-db ERD

Entity-relationship diagram for the `homelab_api` database. Source of truth is `src/schema/`; keep this in sync when a migration changes a table.

```mermaid
erDiagram
    hosts ||--o{ sources : "host_id (RESTRICT, optional)"
    sources ||--o{ discovery_jobs : "source_id (CASCADE)"
    discovery_jobs ||--o{ discovery_queue_items : "job_id (CASCADE)"
    sources ||--o{ inventory_items : "source_id (CASCADE)"
    discovery_jobs |o--o{ inventory_items : "first_job_id (SET NULL)"
    discovery_jobs |o--o{ inventory_items : "last_job_id (SET NULL)"

    hosts {
        uuid id PK
        text name
        host_type host_type "physical | virtual"
        exporter_type exporter_type "node_exporter | windows_exporter"
        text ip_address
        text instance UK "nullable"
        text model3d "nullable"
        timestamptz created_at
    }

    sources {
        uuid id PK
        text name UK
        uuid host_id FK "nullable"
        source_type source_type "windows"
        timestamptz created_at
        timestamptz updated_at
    }

    discovery_jobs {
        uuid id PK
        uuid source_id FK
        text root_path
        text normalized_root_path
        discovery_job_status status "pending | running | completed | failed | cancelled"
        text error "nullable"
        timestamptz created_at
        timestamptz started_at "nullable"
        timestamptz finished_at "nullable"
        timestamptz updated_at
    }

    discovery_queue_items {
        uuid id PK
        uuid job_id FK
        text path
        text normalized_path "UK with job_id"
        discovery_queue_item_status status "queued | in_progress | completed | failed | skipped"
        int priority
        int attempt_count
        int max_attempts
        text last_error "nullable"
        timestamptz available_at
        text claimed_by "nullable"
        uuid claim_token "nullable"
        timestamptz lease_expires_at "nullable"
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at "nullable"
    }

    inventory_items {
        uuid id PK
        uuid source_id FK "UK with normalized_path"
        uuid first_job_id FK "nullable"
        uuid last_job_id FK "nullable"
        inventory_item_type item_type "file | directory"
        text path
        text normalized_path
        text parent_path "nullable, null for roots"
        text normalized_parent_path "nullable"
        text name
        text extension "nullable, files only"
        bigint size_bytes "nullable"
        timestamptz modified_at "nullable"
        timestamptz first_seen_at
        timestamptz last_seen_at
        timestamptz created_at
        timestamptz updated_at
    }
```

## Notes

- **Job vs. queue item vs. inventory item.** A job is one run over a source and owns the lifecycle. A queue item is one directory to explore _within_ that job, so it reaches the source only through the job. An inventory item is keyed by source and outlives any single job.
- **Uniqueness.** `discovery_queue_items` is unique on `(job_id, normalized_path)`. `inventory_items` is unique on `(source_id, normalized_path)`. `discovery_jobs` has a partial unique index on `source_id` where status is `pending` or `running`, so a source has at most one active job.
- **State checks (migration `0007`).** `discovery_queue_items`: `0 <= attempt_count <= max_attempts`, and `in_progress` requires `claimed_by`, `claim_token` and `lease_expires_at`. `inventory_items`: `size_bytes >= 0`.
- **Job root.** Creating a job also upserts its root as an `inventory_items` directory, since no worker records the directory it starts from.
- **Normalized paths** are lowercased, so Windows paths compare case-insensitively.
- **Delete behavior.** Deleting a source cascades to its jobs, queue items and inventory. Cancelling or failing a job returns its in-progress queue items to `queued` with the claim cleared. Deleting a job cascades to its queue items but only nulls `first_job_id`/`last_job_id` on inventory. Deleting a host that a source references is blocked (`RESTRICT`).
