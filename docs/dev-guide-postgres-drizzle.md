# Dev Guide - Postgres & Drizzle

How server apps that need PostgreSQL are structured, introduced by `apps/video-api` / `packages/video-db` (issue #178). This is the first Postgres/Drizzle usage in the repo — `gluetun-sync` and `pi-led-api` have no database.

## Shared DB package (`packages/<name>-db`)

Database access lives in its own library package, not inline in the app, so a later worker/consumer can share it. `packages/video-db` is the reference:

- `src/schema/*.ts` — Drizzle `pg-core` table/enum definitions.
- `src/client.ts` — `createDb(options: PostgresConnectionOptions)` / `closeDb(db)`, built on `drizzle-orm/node-postgres` + `pg`. Takes a plain connection-options object; has no knowledge of `@abbottland/yaml-config`.
- `src/queries/*.ts` — typed query functions consuming the `Database` type.
- `src/migrations.ts` — `runMigrations(db)`, used programmatically (e.g. from Jest integration setup).
- `src/migrate.ts` — standalone CLI script driven by `DATABASE_URL`, for `drizzle-kit`-generated migrations and future CI/k8s migration jobs.
- `drizzle.config.ts` + `drizzle/migrations/` — migrations are generated with `pnpm db:generate` (requires `DATABASE_URL`) and committed to Git.

Apps never auto-run migrations at normal startup. Only the `db:migrate` script and test setup (see below) run them — migrations are a separate deploy step, not an implicit in-process side effect.

## App-side config

The consuming app holds Postgres connection config using the existing `@abbottland/yaml-config` decorator pattern (see `apps/gluetun-sync/src/config.ts` for the base pattern), e.g.:

```ts
export class PostgresConfig {
  @EnvironmentVariable() host: string = 'localhost';
  @EnvironmentVariable({ variableType: EnvironmentVariableType.NUMBER })
  port: number = 5432;
  @EnvironmentVariable() database: string = '';
  @EnvironmentVariable() user: string = '';
  @EnvironmentVariable() password: string = '';
}
```

mounted with `@ConfigSection({ sectionPrefix: 'POSTGRES' })`, then passed straight into the db package's `createDb()`.

## Local Postgres dependency

`docker-compose.yaml` in the app follows the same shape as `gluetun-sync`'s: a smoke-profiled app service plus a `postgres:17-alpine` dependency service with a `pg_isready` healthcheck, wired to the standard `dev:deps` / `dev:deps:down` scripts.

Integration tests run migrations against this real Postgres in Jest's `setupFilesAfterEnv` before creating the Express app (`initDb()` → `runMigrations(db)` → `createServer()`), and close the pool in `afterAll` via `closeDb(db)` to avoid Jest's "worker failed to exit gracefully" warning.

## `skipLibCheck` requirement

`drizzle-orm` ships bundled type definitions for other dialects (mysql/sqlite/singlestore) that fail `tsc` unless `skipLibCheck: true` is set. The root `ts-base.json` does not set this repo-wide, so any package/app whose types touch `@abbottland/video-db` (or any future Drizzle-backed db package) must add `"skipLibCheck": true` to its own `tsconfig.json`, `tsconfig.build.json`, and `tsconfig.test.json` — same as `fui-components`/`fui-icons`/`next-middleware`/`blog`/`diagram-maker` already do for their own reasons.

## Catalog status

`drizzle-orm`, `pg`, and `drizzle-kit` are plain (non-catalog) dependencies in `packages/video-db/package.json` — only one package uses them today. Per [Dependency Management](./dev-guide-dependency-management.md), promote them to `catalog:` once a second package (e.g. a future `video-worker`) needs the same versions, not before.

## turbo.json tasks

`db:generate` and `db:migrate` were added as generic turbo tasks (`cache: false`, `env: ["DATABASE_URL"]`) — the first tasks in the repo needing a `DATABASE_URL`-driven CLI script.
