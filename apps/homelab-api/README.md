# homelab-api

The purpose of this document is to explain what `homelab-api` is and how the application can be developed and tested.

## Overview

`homelab-api` is an Express.js API backing `home-hud`'s `/infra` pages — it tracks user-registered homelab hosts (physical and virtual) and enriches them with live data pulled from Prometheus and Kubernetes.

Routes:

- `GET /healthz` / `GET /readyz` — liveness/readiness checks (from `@abbottland/express`).
- `GET /maps/:type` — cluster topology map (`nodes`/`pods`) for the `/infra/cluster-map` page.
- `GET /hosts` — list hosts, optionally filtered by `?type=physical|virtual`. Each host is enriched with a live `status` (online/offline/unknown) and `cpuUsageRatio` from Prometheus.
- `POST /hosts` — register a new host (`name`, `ipAddress` required; `hostType` defaults to `physical`; `instance` is the Prometheus scrape-target address, e.g. `192.168.6.24:9100`).
- `GET /hosts/:id` — fetch a single host.
- `PATCH /hosts/:id` / `DELETE /hosts/:id` — update/remove a host.
- `GET /hosts/:id/metrics/{cpu,memory,disk-io,temperature}` — per-host time series from Prometheus over a range.
- `GET /hosts/:id/metrics/disk-space` — current filesystem usage snapshot.
- `GET /docs` — interactive Swagger UI for the routes above. The URL is also logged at startup.

Schema and migrations live in `@abbottland/homelab-db` (`packages/homelab-db`); `homelab-api` applies pending migrations itself at startup, same pattern as `video-api`.

## Development Procedure

### Step 1 - Set environment variables

Copy `sample.env` to `.env` and adjust as needed, or generate one via 1Password:

```sh
pnpm env:generate
```

### Step 2 - Start dependencies

```sh
pnpm dev:deps
```

This waits for Postgres to report healthy.

> [!NOTE]
> To stop dependencies, run `pnpm dev:deps:down`. It tears down the Postgres volume too, so the **next** `pnpm dev:deps` starts from an empty database.

### Step 3 - Develop homelab-api

```sh
pnpm dev
```

### Step 4 - Run unit tests

```sh
pnpm test:unit
```

## Seeding hosts from a remote environment

A local database reset (`pnpm dev:deps:down`) wipes hand-registered hosts. Rather than re-entering IPs/instances by hand, `pnpm run seed:remote` pulls the full host list from a remote `homelab-api` (e.g. production) and upserts it into the local database — matching existing rows by `ipAddress` (not `id`, which is a per-environment UUID).

Production `homelab-api` has its own route on the cluster's gateway: `https://homelab-api.local.abbottland.io` (sits alongside `home-hud`'s own route on the same `istio-ingress` gateway, in the `home-hud` namespace — not actually proxied through `home-hud` itself).

```sh
REMOTE_HOMELAB_API_URL=https://homelab-api.local.abbottland.io pnpm run seed:remote
```

Output lists each host as created (`+`) or updated (`~`), e.g.:

```
Fetching hosts from https://homelab-api.local.abbottland.io/hosts ...
Got 11 host(s) from remote.
  ~ updated Bananapi (192.168.4.144)
  + created Chimaera (192.168.4.192)
  ...
Done. Created 6, updated 5.
```

> [!NOTE]
> If `@abbottland/homelab-db` was changed since its last build, rebuild it first (`pnpm --filter @abbottland/homelab-db build`) — `seed:remote` runs against the package's compiled `dist`, not its source.
