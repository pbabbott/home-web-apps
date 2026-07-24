# Dev Guide - Monorepo Architecture

How the app and shared-config package categories in this monorepo are structured.

## Server apps (`gluetun-sync`, `pi-led-api`, `video-api`)

All follow the same pattern:

- `@abbottland/express` wraps Express with shared middleware
- `@abbottland/yaml-config` provides config via decorators + YAML/env files
- `sample.env` documents required environment variables
- Docker Compose for local dev dependencies; `abctl` for Docker builds and publishing
- Jest projects config with separate `unit`, `int`, and `smoke` suites

`video-api` additionally depends on PostgreSQL via a shared `packages/*-db` library package (Drizzle ORM). See [Postgres & Drizzle](./dev-guide-postgres-drizzle.md).

## Frontend apps (`blog`, `diagram-maker`)

- Next.js 16 with `@mdx-js/loader` for content
- TailwindCSS 4 with PostCSS

## Shared config packages

`packages/typescript-config/` — TypeScript presets:

- `ts-base.json` — ESNext, CommonJS, decorators enabled
- `ts-server-build.json` — for Express apps (extends base, emits to `dist/`)
- `ts-lib-base.json` — for packages
- `react-library.json` — for React component packages

`packages/jest-presets` — exports `unitTestPreset`, `integrationTestPreset`, `smokeTestPreset`, and `jestReporters`. Apps import these in `jest.config.ts` and use Jest `projects` to run multiple suites.
