# budget-worker

Background worker for the budget feature. It polls `budget_jobs` (via `@abbottland/budget-db`), claims the oldest pending job with `FOR UPDATE SKIP LOCKED`, runs the handler registered for its `operation`, and records completion or failure. Jobs are created through `budget-api`. Structured like `video-worker`.

Operations: `hello` (placeholder), `ynab_sync`, which stores raw YNAB API responses (see [YNAB ingestion](../../docs/budget/ynab-ingestion.md)), and `ynab_transform`, which folds them into typed tables (see [YNAB typed tables](../../docs/budget/ynab-tables.md)); and `apply_filter_selections`, which categorizes/approves matching unapproved transactions **in YNAB** per saved rules and logs each action (see [Filter rules](../../docs/budget/filter-selections.md)). A successful sync enqueues a transform, and a transform that applied new data enqueues the apply job. Needs `YNAB_API_TOKEN`; `YNAB_PLAN_ID` picks the one plan to sync.

## Layout

- `src/index.ts` — config, migrations (advisory lock), db, HTTP server, poll loop; graceful shutdown waits for the in-flight job.
- `src/worker/poll-loop.ts` — claim loop (`POLL_INTERVAL_MS` when idle, immediate re-poll after a job).
- `src/worker/job-processor.ts` — runs the handler with a heartbeat; never throws, failures are recorded on the job.
- `src/worker/operations/` — handler registry (`index.ts`) and one file per operation. Add new job types here (and in `budget-api`'s `createJobSchema`).
- `GET /healthz`, `GET /readyz` — probes only; the worker has no job API.

## Development

Port `4006`. It shares one Postgres (database `budget`) with `budget-api`: the API creates jobs there and the worker claims them. Either app's `pnpm dev:deps` starts it on host port `5432`; run it from just one of them. (Don't use 5433: `homelab-api` and `backup-worker` dev deps own it.)

```sh
cp sample.env .env
pnpm dev:deps
pnpm dev
pnpm test:unit
pnpm test:int        # needs dev:deps running; runs in its own throwaway DB (budget_worker_test)
pnpm dev:deps:down
```
