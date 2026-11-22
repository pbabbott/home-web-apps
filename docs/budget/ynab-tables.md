# YNAB typed tables (silver layer)

Queryable tables built from the raw layer ([YNAB ingestion](./ynab-ingestion.md)). Code: `packages/budget-db/src/schema/ynab-*.ts` (tables), `src/queries/ynab-transform.ts` (apply/watermark/reset), `apps/budget-worker/src/worker/operations/ynab-transform/` (the job and the per-endpoint mappers).

## Layers

| Layer          | What                                                                                                                                                                                                                                             | Rule                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| raw (bronze)   | `ynab_raw_responses`, `ynab_sync_state`                                                                                                                                                                                                          | append-only, source of truth, costs YNAB API requests to fill          |
| typed (silver) | `ynab_accounts`, `ynab_category_groups`, `ynab_categories`, `ynab_payees`, `ynab_transactions` + `ynab_subtransactions`, `ynab_scheduled_transactions` + `ynab_scheduled_subtransactions`, `ynab_months` + `ynab_month_categories`, `ynab_plans` | current state, disposable: rebuilt from raw at any time, no YNAB calls |
| marts (gold)   | `ynab_transactions_enriched` (view)                                                                                                                                                                                                              | read silver only, never raw JSON; add your own here                    |

Conventions: primary key `(plan_id, id)` (months: `(plan_id, month)`; month categories: `(plan_id, month, category_id)`); money is **bigint milliunits** (1000 = 1 unit; convert in views); every row has `deleted` (soft delete, YNAB marks removed entities in deltas), `last_raw_response_id` (the raw response that last wrote it) and `updated_at`. No foreign keys between typed tables: deltas for different endpoints arrive independently (a transaction can land before its payee), so join with LEFT JOINs and filter `NOT deleted`.

## How the load works

`ynab_transform` is a job (`POST /jobs`, `{"operation":"ynab_transform","parameters":{"endpoints":[...],"rebuild":false}}`). A successful `ynab_sync` enqueues one automatically. It makes no YNAB calls, so it is safe to run any time.

1. Per `(plan_id, endpoint)` it lists raw responses after the watermark in `ynab_transform_state` (ordered by `fetched_at, id`), one at a time.
2. Each response is mapped by a pure function in `ynab-transform/mappers.ts` to typed rows, then upserted by primary key. Split lines (`*_subtransactions`) are replaced wholesale for every parent present in the response.
3. A response with no cursor (`server_knowledge_requested` is null) is a full snapshot: it lists every live entity, so rows of that plan and table it did not touch are marked `deleted`.
4. Rows and watermark advance in **one transaction**, so a crash neither skips nor double-applies. A response that fails to map fails the job naming the raw response id; the watermark stays put and the next run retries it.
5. `plans` has no deltas: only the newest `plans` response is applied.

`rebuild: true` drops the typed rows and watermark for the chosen endpoints and re-folds every raw response. Use it after changing a mapper or a table.

## Changing things

- **New column**: add it to the schema file and mapper, `pnpm --filter @abbottland/budget-db db:generate`, run the job with `rebuild` for that endpoint.
- **New mart**: a Drizzle `pgView` (or a table filled by a new job) under `packages/budget-db/src/schema/views/`, listed in `drizzle.config.ts`, reading typed tables only. Alias every selected column (`sql\`...\`.as('x')`): duplicate names such as several `name`columns make`CREATE VIEW` fail.
- **New endpoint**: see "Adding an endpoint" in the ingestion doc, then add its tables, a mapper, and an entry in `YNAB_ENDPOINT_TABLES`.

## Example

```sql
SELECT date, amount_units, account_name, payee_name, category_name
FROM ynab_transactions_enriched
WHERE NOT is_transfer ORDER BY date DESC LIMIT 20;
```
