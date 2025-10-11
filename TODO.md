# Fix dev commands

## fix dev on various apps

- each app should have dev
- and deps:up and deps:down
- maybe dev should include deps up to make it more seamless?
- each one should be independently runnable
- this will help with smoke tests as well
- and deployment as it'll have a docker-compose example!

## fix root commands

setup individual and full command set in turbo.json and root package.json

see this root package.json example

```json
{
  "name": "monorepo",
  "scripts": {
    "setup": "run-s setup:secrets setup:deps",
    "setup:secrets": "setup-secrets --vault-type dotenv-vault",
    "setup:deps": "docker-compose up -d postgres redis",

    "dev": "turbo run dev",
    "dev:gluetun-sync": "run-s setup:secrets setup:deps && pnpm --filter gluetun-sync dev",
    "dev:pi-led-api": "run-s setup:secrets setup:deps && pnpm --filter pi-led-api dev",

    "test:e2e": "turbo run test:e2e",
    "test:e2e:gluetun-sync": "run-s setup build:gluetun-sync && node scripts/run-e2e.js gluetun-sync",

    "build": "turbo run build",
    "build:gluetun-sync": "pnpm --filter gluetun-sync build",

    "clean": "docker-compose down -v && turbo run clean",

    "onboard": "run-s install setup",
    "install": "pnpm install"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5"
  }
}
```

# Smoke Tests (e2e)

set up smoke e2e test

- start deps via command (docker compose up -d)
- start app via docker as well
- pnpm test:e2e use BASE_URL or something similar to hit the service running with docker

- apply this to both apps

# integration tests

- pi-led-api could use better integration tests

# Linting

- Centralize linting, tidying up with pnpm features

# fui-components

- rebuild component library from scratch following tutorials online
- setup visual tests
- follow tutorials
- maybe move the whole folder and start fresh?

# swagger

- get swagger endpoints up for APIs

# env management

abctl to build .env files across various applications?
