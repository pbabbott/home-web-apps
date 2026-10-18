# Exodus

Exodus is a one-time migration of files from Windows machines to the NAS. This document records what exists so far, how it works, and the decisions made along the way. Only the **discovery orchestration** layer is built; everything downstream of it is not.

## The idea

An OpenClaw agent runs on a cron schedule. Each run starts a fresh session with no memory of the last one, so the agent cannot hold its progress in conversation history. Instead it explores a machine one directory at a time through a durable queue in Postgres: claim a directory, inspect its immediate children, record the files and directories it found as inventory items, enqueue the subdirectories, repeat. Whatever is not written to Postgres is lost, so the database is the single source of truth. Eventually the agent will submit valuable files for human review and copying to the NAS.

A human registers machines, starts and monitors jobs, and handles problems. The agent processes the work inside those jobs.

## Status

| Built                                                           | Not built                                       |
| --------------------------------------------------------------- | ----------------------------------------------- |
| Sources, discovery jobs, directory queue (database + API)       | The OpenClaw agent itself                       |
| Lease-based claiming, retries, resumability                     | Filesystem scanning                             |
| Windows path normalization                                      | Exclusion rules                                 |
| Inventory items: files and directories found (database + API)   | Review UI, file copying to the NAS              |
| home-hud pages: sources, source detail, jobs, inventory browser | Authentication on the API (none, like the rest) |
| MCP tools for the agent's work loop (`POST /mcp`)               |                                                 |
| Unit and integration tests                                      |                                                 |

## Where things live

- **Schema, migrations, queries** — `packages/homelab-db` (`src/schema/discovery.ts`, `src/queries/discovery/`, migrations `0003`–`0008`, and an [entity-relationship diagram](../../packages/homelab-db/ERD.md)). The same package and the same `homelab_api` database as `hosts`.
- **API** — `apps/homelab-api` (`controllers/discovery/` split by domain, `services/discovery/`, `schemas/discovery/`, `routes/`, `openapi/`, `lib/windows-path.ts`, `mcp.ts`). Interactive docs at `/docs`. The README has the agent workflow and the rules in short form.
- **UI** — `apps/home-hud/src/app/exodus/`, under the Exodus menu in the nav.

## Contents

- [Data Model](./data-model.md) - the four tables, state checks, migration history.
- [How Processing Works](./processing.md) - claiming and leases, incremental exploration, inventory recording, failures and retries, finishing a job, paths.
- [API and MCP](./api.md) - REST routes and the agent's MCP tools.
- [UI (home-hud)](./ui.md) - the `/exodus/*` pages.
- [Decisions and Learnings](./decisions.md) - design decisions, gotchas, and lessons from building it.
- [Running, Testing and Next Steps](./operations.md) - how to run and test, and what is left.
