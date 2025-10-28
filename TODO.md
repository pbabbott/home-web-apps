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

# fui-components-bak

- rebuild component library from scratch following tutorials online
- setup visual tests
- follow tutorials
- maybe move the whole folder and start fresh?

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
