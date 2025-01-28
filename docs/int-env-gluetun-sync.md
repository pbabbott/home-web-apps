# Integration Environment - Gluetun Sync

The purpose of this document is to explain how the application gluetun-sync can be developed within an integration environment. 

# Overview

The gluetun-sync application requires two services to be running so that it may be developed: `qbittorrent` and `gluetun`.  `gluetun-sync` is meant to facilitate communication among these services so it makes sense that having these services running will enable a robust development or test environment.

## Development Procedure

### Step 1 - Build .env file for media services

The first step is to set all necessary environment variables.  This process has been scripted out thanks to the 1Password connect-server integration.  Start by running this command to edit the `.env` file in the root of this project.

```sh
./scripts/env-media.sh
```

### Step 2 - Start media services

The next step is to start the docker compose media stack.

```sh
docker compose -f ./docker-compose.media.yml up -d
```

### Step 3 - Build .env file for gluetun-sync

This will create an `.env` file at `apps/gluetun-sync/.env`

```sh
./scripts/env-gluetun-sync.sh
```

### Step 4 - Develop gluetun-sync

Next up, you can go directly to gluetun-sync to develop the app.

```sh
cd ./apps/gluetun-sync
pnpm dev
```