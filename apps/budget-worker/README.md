# budget-worker

Background worker for the budget feature. It polls `budget_jobs` (via `@abbottland/budget-db`), claims the oldest pending job with `FOR UPDATE SKIP LOCKED`, runs the handler registered for its `operation`, and records completion or failure. Jobs are created through `budget-api`. Structured like `video-worker`.

Operations: `hello` (placeholder) and `ynab_sync`, which stores raw YNAB API responses; see [YNAB ingestion](../../docs/budget/ynab-ingestion.md). Needs `YNAB_API_TOKEN`.

## Layout

- `src/index.ts` — config, migrations (advisory lock), db, HTTP server, poll loop; graceful shutdown waits for the in-flight job.
- `src/worker/poll-loop.ts` — claim loop (`POLL_INTERVAL_MS` when idle, immediate re-poll after a job).
- `src/worker/job-processor.ts` — runs the handler with a heartbeat; never throws, failures are recorded on the job.
- `src/worker/operations/` — handler registry (`index.ts`) and one file per operation. Add new job types here (and in `budget-api`'s `createJobSchema`).
- `GET /healthz`, `GET /readyz` — probes only; the worker has no job API.

## Development

Port `4006`. Postgres is published on host port `5433` (same as `homelab-api`/`backup-worker` dev deps, so only one of those can be up at a time).

```sh
cp sample.env .env
pnpm dev:deps
pnpm dev
pnpm test:unit
pnpm test:int        # needs dev:deps running
pnpm dev:deps:down
```
