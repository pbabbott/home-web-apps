# budget-api

Express.js API for the budget feature. It accepts job requests and stores them durably in PostgreSQL for `budget-worker` (`apps/budget-worker`) to claim and process. Structured like `video-api`.

**Status: early.** Job queue plus raw YNAB ingestion; the modelled budget domain is not built yet.

## Routes

- `GET /healthz` — liveness (from `@abbottland/express`).
- `GET /readyz` — readiness; `200` if Postgres is reachable and the schema is current, `503` otherwise.
- `POST /jobs` — create a job. Body is `{ operation, parameters }`, discriminated on `operation` (`src/schemas/jobs.ts`). Operations: `hello` (`parameters: { name? }`) and `ynab_sync` (see [YNAB ingestion](../../docs/budget/ynab-ingestion.md)).
- `GET /jobs?status=<pending|processing|completed|failed>` — list jobs, newest first (max 100).
- `GET /jobs/:id` — fetch one job.
- `GET /ynab/sync-state` — YNAB delta cursor per plan/endpoint.
- `GET /ynab/sync-runs`, `GET /ynab/plans`, `GET /ynab/raw-responses` — metadata for the home-hud YNAB page (never raw payloads).
- `GET /docs` — Swagger UI, generated from the Zod schemas (`src/openapi.ts`).

Schema and migrations live in `@abbottland/budget-db` (`packages/budget-db`), shared with `budget-worker`. The app applies pending migrations itself at startup under an advisory lock; see [Postgres & Drizzle](../../docs/dev-guide-postgres-drizzle.md).

## Adding a job type

1. Add a branch to `createJobSchema` in `src/schemas/jobs.ts` (and the OpenAPI doc picks it up).
2. Add a handler in `apps/budget-worker/src/worker/operations/` and register it in that folder's `index.ts`.

## Development

Port `4005`. Postgres is published on host port `5432`, so it conflicts with `video-api`'s dev dependency if both are up.

```sh
cp sample.env .env
pnpm dev:deps        # starts Postgres only; the app migrates itself on start
pnpm dev             # tsc-watch + node
pnpm test:unit
pnpm test:int        # needs dev:deps running
pnpm dev:deps:down
```

Schema changes: edit `packages/budget-db/src/schema/*.ts`, add the file to `drizzle.config.ts` if new, then `DATABASE_URL=... pnpm --filter @abbottland/budget-db db:generate` and commit the migration.
