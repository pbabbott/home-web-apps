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
    "planIds": ["..."],
    "endpoints": ["transactions"],
    "full": false
  }
}
```

All parameters are optional. `full: true` ignores cursors (full snapshots; use sparingly). A normal run costs `1 + 6 × plans` requests. The job stops cleanly, completing with a message listing what was skipped, once `X-Rate-Limit` shows ≥ 170/200 used or YNAB returns 429; the next run resumes from the stored cursors. `GET /ynab/sync-state` shows the cursors.

## Configuration

`budget-worker` reads `YNAB_API_TOKEN` (Personal Access Token) and `YNAB_API_URL` (default `https://api.ynab.com/v1`) from environment variables; see `apps/budget-worker/sample.env`. The token comes from 1Password: `abctl.yml` maps the item **`YNAB PAT`** (field `ynab_pat`, vault `Homelab`) to `YNAB_API_TOKEN`, so `pnpm env:generate` fills `.env` locally and in CI, same as `Github PAT` for `harbor-cleanup`. That item must exist before `env:generate` will succeed.

The token defaults to the sentinel `not-configured` so a missing token doesn't stop the worker at startup; `ynab_sync` fails the job instead. It is only sent as a bearer header and never logged. k8s deployment (injecting the same secret) is not done yet.

## Adding an endpoint

Add it to `YNAB_ENDPOINTS` in `packages/budget-db/src/schema/ynab-raw-responses.ts` (no migration needed, it is a text column), to the `endpoints` enum in `apps/budget-api/src/schemas/jobs.ts`, and re-run a sync.

## Not built yet

Normalised tables built from the raw rows, a home-hud UI, the scheduled trigger (k8s CronJob), and payload retention/compaction.
