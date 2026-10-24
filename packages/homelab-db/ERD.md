# homelab-db ERD

Entity-relationship diagram for the `homelab_api` database. Source of truth is `src/schema/`; keep this in sync when a migration changes a table.

```mermaid
erDiagram
    hosts ||--o{ sources : "host_id (RESTRICT, optional)"
    sources ||--o{ discovery_jobs : "source_id (CASCADE)"
    discovery_jobs ||--o{ discovery_queue_items : "job_id (CASCADE)"
    sources |o--o{ exclusion_rules : "source_id (CASCADE)"
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
        text reason "nullable, why it was queued"
        jsonb result "nullable, summary + paths skipped without queueing"
        timestamptz available_at
        text claimed_by "nullable"
        text last_claimed_by "nullable, kept after release/expiry/failure"
        uuid claim_token "nullable"
        timestamptz lease_expires_at "nullable"
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at "nullable"
    }

    inventory_items {
        uuid id PK
        uuid source_id FK "UK with normalized_root_path"
        uuid first_job_id FK "nullable"
        uuid last_job_id FK "nullable, most recent proposing job"
        inventory_item_kind kind "file | directory"
        text root_path
        text normalized_root_path
        text display_name
        text summary
        inventory_item_recommendation recommendation "back_up | skip | needs_review (agent)"
        inventory_item_confidence confidence "low | medium | high (agent)"
        text recommendation_reason "agent"
        jsonb evidence "agent, InventoryItemEvidence"
        timestamptz recommended_at "when recommendation, confidence or reason last changed"
        text recommended_by "nullable"
        inventory_item_decision decision "pending | approved | rejected (human), default pending"
        text decision_note "nullable"
        timestamptz decided_at "nullable, set unless pending"
        text decided_by "nullable"
        timestamptz first_seen_at
        timestamptz last_seen_at
        timestamptz created_at
        timestamptz updated_at
    }

    exclusion_rules {
        uuid id PK
        uuid source_id FK "nullable, null = global; UK with normalized_path (NULLS NOT DISTINCT)"
        text path
        text normalized_path
        exclusion_rule_scope scope "selective_only | exclude_subtree"
        text reason "nullable"
        timestamptz created_at
        timestamptz updated_at
    }

    audit_events {
        uuid id PK
        uuid source_id "no FK"
        uuid job_id "no FK"
        uuid queue_item_id "no FK"
        uuid exclusion_rule_id "no FK"
        uuid inventory_item_id "no FK"
        text event_type
        audit_actor_type actor_type "human | openclaw | system"
        text actor_id "nullable"
        jsonb details "nullable"
        timestamptz created_at
    }
```

## Notes

- **Job vs. queue item vs. inventory item.** A job is one run over a source and owns the lifecycle. A queue item is one unit of work _within_ that job, so it reaches the source only through the job. An inventory item is keyed by source and outlives any single job.
- **Uniqueness.** `discovery_queue_items` is unique on `(job_id, normalized_path)`. `inventory_items` is unique on `(source_id, normalized_root_path)`. `discovery_jobs` has a partial unique index on `source_id` where status is `pending` or `running`, so a source has at most one active job.
- **State checks (migration `0007`).** `discovery_queue_items`: `0 <= attempt_count <= max_attempts`, and `in_progress` requires `claimed_by`, `claim_token` and `lease_expires_at`. `inventory_items`: `decided_at` is set unless `decision = 'pending'` (migration `0010`).
- **Review candidates (migration `0010`, renamed `inventory_items` by `0012`).** An inventory item is the agent's proposed backup unit, unique per `(source_id, normalized_root_path)`. The agent owns the recommendation columns and a human owns the `decision*` columns; the agent upsert never writes the latter, and a `CHECK` requires `decided_at` unless the decision is `pending`. `0010` moved the old catalogue's review decisions into it (`candidate`→`approved`, `not_needed`→`rejected`, a noted `needs_review`→`pending`).
- **Audit (migration `0009`).** `audit_events` ids have no foreign keys on purpose: the log must outlive deleted rules, items and sources. `exclusion_rules` is unique per owner and path, and `NULLS NOT DISTINCT` makes that cover global rules.
- **Normalized paths** are lowercased, so Windows paths compare case-insensitively.
- **Catalogue removal (migration `0011`).** The old per-path `inventory_items` catalogue and `audit_events.inventory_item_id` were dropped, the legacy `inventory_item.review_*` audit events were deleted, and the `inventory_item_type` enum was renamed `candidate_kind`.
- **Rename (migration `0012`).** `review_candidates` became `inventory_items`; the `candidate_*` enums became `inventory_item_*`; `audit_events.review_candidate_id` became `inventory_item_id`; `review_candidate.*` audit event types became `inventory_item.*`. Constraints and indexes were renamed to match; no data moved.
- **Delete behavior.** Deleting a source cascades to its jobs, queue items and inventory items. Cancelling or failing a job returns its in-progress queue items to `queued` with the claim cleared. Deleting a job cascades to its queue items but only nulls `first_job_id`/`last_job_id` on inventory items. Deleting a host that a source references is blocked (`RESTRICT`).
