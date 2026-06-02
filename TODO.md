# Fix dev commands

## fix dev on various apps

TODO: write document on this setup..?

- ✅ each app should have dev
- ✅ and deps:up and deps:down
- ✅ maybe dev should include deps up to make it more seamless?
- each one should be independently runnable
- this will help with smoke tests as well
- and deployment as it'll have a docker-compose example!

## fix root commands

setup individual and full command set in turbo.json and root package.json

see this root package.json example

TODO: document various commands runnable from root?

# e2e test setup

- start deps via command (docker compose up -d)
- start app via docker as well
- pnpm test:e2e use BASE_URL or something similar to hit the service running with docker

TODO: set this up against pi-led-api

# integration tests for pi-led-api

- pi-led-api could use better integration tests

# Linting cleanup

- Centralize linting, tidying up with pnpm features

## Eliminate build:npm dependency from lint (source types)

Currently `lint` in turbo.json depends on `^build:npm` so tsc in blog/diagram-maker can
resolve types from `fui-components` and `fui-icons` (both point `types` at `./dist/index.d.ts`).

Goal: switch to the Turborepo "Just-in-Time" internal package pattern so lint needs zero
upstream build.

Steps:

1. In `packages/fui-components/package.json` and `packages/fui-icons/package.json`, change
   `types` and the `exports["."].types` field from `./dist/index.d.ts` → `./src/index.ts`
2. Set `lint` `dependsOn` in `turbo.json` back to `[]`
3. Verify tsc in blog and diagram-maker resolves correctly (`moduleResolution: "bundler"` already
   supports `.ts` source imports from packages)

Both packages are private/internal, so no external consumers are affected. The `build:npm` script
stays intact for actual deploy builds.

# fui-components

- ✅ rebuild component library from scratch following tutorials online
  - ✅ follow tutorials
  - ✅ maybe move the whole folder and start fresh?
- setup visual tests

# swagger

- get swagger endpoints up for gluetun and pi-led-api APIs

# env management

✅ abctl to build .env files across various applications?
TODO: document how abctl can generate a `.env` file from a sample and secrets

# dependabot

automatic prs using tests

# abctl

- convert to oclif
- this will maybe remove the duplicate pnpm install situation.

# Convert all of these to issues

GH issues.
