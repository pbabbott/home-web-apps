# Dev Guide - Postgres & Drizzle

How server apps that need PostgreSQL are structured, introduced by `apps/video-api` / `packages/video-db` (issue #178). This is the first Postgres/Drizzle usage in the repo — `gluetun-sync` and `pi-led-api` have no database.

## Shared DB package (`packages/<name>-db`)

Database access lives in its own library package, not inline in the app, so a later worker/consumer can share it. `packages/video-db` is the reference:

- `src/schema/*.ts` — Drizzle `pg-core` table/enum definitions.
- `src/client.ts` — `createDb(options: PostgresConnectionOptions)` / `closeDb(db)`, built on `drizzle-orm/node-postgres` + `pg`. Takes a plain connection-options object; has no knowledge of `@abbottland/yaml-config`.
- `src/queries/*.ts` — typed query functions consuming the `Database` type.
- `src/migrations.ts` — `runMigrations(db)` runs pending migrations on an existing `Database`/connection, used by Jest integration setup where a single test process is the only thing touching the database. `runMigrationsWithLock(options)` is what apps call: it opens its own dedicated connection, holds a Postgres session-level advisory lock for the duration, then calls `runMigrations` internally. `drizzle`'s `migrate()` has no locking of its own — a plain read-then-transaction-write — so without the lock, two processes racing to migrate a fresh database (two replicas, or `video-api` and `video-worker` starting at once) would both try to create the same tables and one would crash. The lock releases automatically if the holding connection drops, so a crash mid-migration can't leave it stuck.
- `src/migrate.ts` — standalone CLI script driven by `DATABASE_URL`, for `drizzle-kit`-generated migrations. Mainly useful for a one-off manual migrate without booting the full app; not lock-wrapped, since it isn't meant to be run concurrently with itself.
- `drizzle.config.ts` + `drizzle/migrations/` — migrations are generated with `pnpm db:generate` (requires `DATABASE_URL`) and committed to Git.

Apps apply pending migrations to themselves at startup — `index.ts` calls `runMigrationsWithLock(config.postgres)` before doing anything else, and exits non-zero if it fails — so pointing a fresh deploy at any Postgres (local, test, prod) brings the schema up to date with no separate migrate-before-deploy step to remember. See `apps/video-api/src/index.ts` / `apps/video-worker/src/index.ts` for the reference wiring.

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

`docker-compose.yaml` in the app follows the same shape as `gluetun-sync`'s: a smoke-profiled app service plus a `postgres:17-alpine` dependency service with a `pg_isready` healthcheck, wired to the standard `dev:deps` / `dev:deps:down` scripts. `dev:deps` only starts Postgres — it does not run migrations; the app migrates itself the moment it starts (`pnpm dev`).

Integration tests run migrations against this real Postgres in Jest's `setupFilesAfterEnv` before creating the Express app (`initDb()` → `runMigrations(db)` → `createServer()`), and close the pool in `afterAll` via `closeDb(db)` to avoid Jest's "worker failed to exit gracefully" warning. Test setup uses the unlocked `runMigrations(db)` directly rather than `runMigrationsWithLock` — a single test process is never racing itself.

## `skipLibCheck` requirement

`drizzle-orm` ships bundled type definitions for other dialects (mysql/sqlite/singlestore) that fail `tsc` unless `skipLibCheck: true` is set. The root `ts-base.json` does not set this repo-wide, so any package/app whose types touch `@abbottland/video-db` (or any future Drizzle-backed db package) must add `"skipLibCheck": true` to its own `tsconfig.json`, `tsconfig.build.json`, and `tsconfig.test.json` — same as `fui-components`/`fui-icons`/`next-middleware`/`blog`/`diagram-maker` already do for their own reasons.

## Catalog status

`drizzle-orm`, `pg`, and `drizzle-kit` are plain (non-catalog) dependencies in `packages/video-db/package.json` — only one package uses them today. Per [Dependency Management](./dev-guide-dependency-management.md), promote them to `catalog:` once a second package (e.g. a future `video-worker`) needs the same versions, not before.

## turbo.json tasks

`db:generate` and `db:migrate` were added as generic turbo tasks (`cache: false`, `env: ["DATABASE_URL"]`) — the first tasks in the repo needing a `DATABASE_URL`-driven CLI script.
