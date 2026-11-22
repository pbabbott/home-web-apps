# YNAB ingestion (raw layer)

How YNAB data lands in the `budget` Postgres database. Code: `packages/budget-db` (tables, queries), `apps/budget-worker/src/worker/operations/ynab-sync/` (the job), `apps/budget-worker/src/api/ynab/` (HTTP client).

## Why a raw layer

YNAB allows **200 requests/hour per token**. Every response is stored verbatim in `ynab_raw_responses` so later transformation can be replayed from our own database instead of calling YNAB again.

## Contract

- **Append-only.** One row per HTTP response; rows are never updated or deleted by the app.
- **Deltas.** Plan-scoped endpoints (`accounts`, `categories`, `months`, `payees`, `scheduled_transactions`, `transactions`) are fetched with `last_knowledge_of_server`, so a repeat sync stores only changes. `server_knowledge_requested = null` marks a full snapshot. To rebuild current state, fold a `(plan_id, endpoint)`'s rows in `fetched_at` order (`listYnabRawResponses` returns them that way).
- **Cursor.** `ynab_sync_state` holds the latest `server_knowledge` per `(plan_id, endpoint)`. It is advanced in the same transaction as the raw insert (`recordYnabRawResponse`), so a crash never loses or skips a delta. Failed (non-2xx) responses are not stored.
- `GET /plans` has no delta; its response is stored each run with `plan_id = null`.
- Amounts in payloads are YNAB **milliunits** (1000 = 1 currency unit).

## Running a sync

`POST /jobs` on `budget-api` (`/docs` has the schema):

```json
{
  "operation": "ynab_sync",
  "parameters": {
    "endpoints": ["transactions"],
    "full": false
  }
}
```

All parameters are optional. Only the plan named by `YNAB_PLAN_ID` is ever synced (there is no per-job plan override, and "full sync" doesn't change that); the job fails if that variable is unset or the plan isn't visible to the token. `full: true` ignores cursors (full snapshots; use sparingly). A run costs 7 requests (1 plan list + 6 endpoints for the one plan). The job stops cleanly, completing with a message listing what was skipped, once `X-Rate-Limit` shows ≥ 170/200 used or YNAB returns 429; the next run resumes from the stored cursors. `GET /ynab/sync-state` shows the cursors, `GET /ynab/sync-runs` one summary row per sync (full downloads vs updates, total size), `GET /ynab/plans` the plan names, and `GET /ynab/raw-responses` per-response metadata (never payloads). home-hud's `/budget/sync` page shows these.

## Configuration

`budget-worker` reads `YNAB_API_TOKEN` (Personal Access Token), `YNAB_PLAN_ID` (the id from the plan's app.ynab.com URL) and `YNAB_API_URL` (default `https://api.ynab.com/v1`) from environment variables; see `apps/budget-worker/sample.env`. The token comes from 1Password: `abctl.yml` maps the item **`YNAB PAT`** (field `ynab_pat`, vault `Homelab`) to `YNAB_API_TOKEN`, so `pnpm env:generate` fills `.env` locally and in CI, same as `Github PAT` for `harbor-cleanup`. That item must exist before `env:generate` will succeed.

The token defaults to the sentinel `not-configured` so a missing token doesn't stop the worker at startup; `ynab_sync` fails the job instead. It is only sent as a bearer header and never logged. k8s deployment (injecting the same secret) is not done yet.

CI loads the real token into `.env`, so `apps/budget-worker/tests/jest.integration.setup.ts` overwrites the YNAB config (token unset, dead API URL) before every integration test file. Tests must never reach YNAB: one that needs sync behaviour mocks `ynabGet` and sets its own config (see `ynab-sync.integration.test.ts`).

## Adding an endpoint

Add it to `YNAB_ENDPOINTS` in `packages/budget-db/src/schema/ynab-raw-responses.ts` (no migration needed, it is a text column), to the `endpoints` enum in `apps/budget-api/src/schemas/jobs.ts`, and re-run a sync.

## Not built yet

Normalised tables are built by the `ynab_transform` job (see [YNAB typed tables](./ynab-tables.md)). Not built yet: transform status in home-hud, the scheduled trigger (k8s CronJob), and payload retention/compaction.
