# Filter rules (FilterSelections)

A **FilterSelection** is a saved rule that selects YNAB transactions and says what to do with the unapproved ones: **categorize** and/or **auto approve**. The `apply_filter_selections` job runs the enabled rules after the ETL and writes an audit entry for everything it does. Managed in home-hud at `/budget/filters`; the log is at `/budget/audit`.

## Model (`packages/budget-db`)

- `budget_filter_selections` — the rule: `account_id?`, `payee_id?`, `amount_min_milliunits?`, `amount_max_milliunits?` (at least one filter), `category_id?`, `auto_approve` (at least one action), `enabled`. Filters match by YNAB **id**, so renaming an account or payee in YNAB does not break a rule. Amounts are signed milliunits: outflows are negative.
- `budget_filter_selection_audit` — append-only. One row per action (`categorize` / `approve`) with `status` `applied`, `skipped_conflict` or `failed`, the transaction snapshot, `from_value` / `to_value`, and `rule_description` + `rule_snapshot`: the rule's text and fields **as they were at apply time**. There is no foreign key to the rule, so editing or deleting a rule never rewrites history.

## One matcher for preview and job

`filterConditions` in `src/queries/filter-selections.ts` builds the SQL over the `ynab_transactions_enriched` view. The editor preview (`POST /filter-selections/preview`) and the job both use it, so the preview is what the job matches. The preview shows all matching history; "would act on" counts only the actionable subset below.

## What the job touches

Only transactions that are **unapproved, not a transfer, not split and not deleted**. A category is set only on **uncategorized** transactions (an already-categorized one can still be approved). If two enabled rules want different categories for one transaction, nothing is applied to it and a `skipped_conflict` entry is logged per rule (it is logged again on each run until the rules are fixed). Approve flags from several rules merge.

## The job (`apply_filter_selections`)

1. Load enabled rules, find actionable matches, resolve conflicts (`resolveMatches`).
2. Drop actions already audited as `applied` (so a run while the typed tables are stale never re-sends a change).
3. `PATCH /plans/{plan}/transactions` in batches of 100 (one YNAB request each) via `ynabPatch`, then write the audit rows. A rejected batch writes `failed` rows and fails the job; a 429 stops cleanly with no rows for that batch.
4. If anything was written, queue `ynab_sync` for the `transactions` endpoint so the change flows back raw -> typed.

Chain: `ynab_sync` -> `ynab_transform` (enqueues apply when it applied new raw responses) -> `apply_filter_selections` -> `ynab_sync {transactions}` -> `ynab_transform` -> apply again, which finds nothing and ends the chain. "Apply filter rules" on `/budget/sync` runs it manually. It **writes to YNAB**, which is why the integration setup keeps the token unset (see [YNAB ingestion](./ynab-ingestion.md)); tests mock `ynabPatch`.

## Adding a filter type (for example date ranges)

Add the column to `budget_filter_selections` (+ migration), a condition in `filterConditions`, the clause in `describeRule` (`src/filter-selection-rules.ts`), the field in budget-api's `filterSelectionBodySchema` / `previewBodySchema`, and the control in home-hud's `FilterEditor`.
