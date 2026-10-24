# Exodus

Exodus is a one-time migration of files from Windows machines to the NAS. This document records what exists so far, how it works, and the decisions made along the way. The **discovery orchestration** layer and the **inventory item** model and its review UI are built; the agent itself and the copy workflow are not.

## The idea

An OpenClaw agent runs on a cron schedule. Each run starts a fresh session with no memory of the last one, so the agent cannot hold its progress in conversation history. Instead it explores a machine **selectively** through a durable queue in Postgres: claim a directory, decide for each thing in it whether to skip it, explore it further (queue it with a reason), or propose it as a **inventory item**, then complete the directory. It is not a crawl and it keeps no per-file catalogue. Whatever is not written to Postgres is lost, so the database is the single source of truth. A human approves or rejects inventory items; a future copy workflow acts only on approved ones. See [Inventory Items](./inventory.md).

A human registers machines, starts and monitors jobs, and handles problems. The agent processes the work inside those jobs.

## Status

| Built                                                        | Not built                 |
| ------------------------------------------------------------ | ------------------------- |
| Sources, discovery jobs, directory queue (database + API)    | The OpenClaw agent itself |
| Lease-based claiming, retries, resumability                  | Filesystem scanning       |
| Windows path normalization                                   | File copying to the NAS   |
| Inventory items, human decisions, exclusion rules, audit log |                           |
| home-hud pages: sources, jobs, inventory item review         | Bulk review actions       |
| MCP tools for the agent's work loop (`POST /mcp`)            |                           |
| Per-source file access (SMB) and file preview                |                           |
| Unit and integration tests                                   |                           |

## Where things live

- **Schema, migrations, queries** — `packages/homelab-db` (`src/schema/discovery.ts`, `src/queries/discovery/`, `src/queries/inventory-items.ts`, migrations `0003`–`0012`, and an [entity-relationship diagram](../../packages/homelab-db/ERD.md)). The same package and the same `homelab_api` database as `hosts`.
- **API** — `apps/homelab-api` (`controllers/discovery/` split by domain, `services/discovery/`, `schemas/discovery/`, `routes/`, `openapi/`, `lib/windows-path.ts`, `mcp.ts`). Interactive docs at `/docs`. The README has the agent workflow and the rules in short form.
- **UI** — `apps/home-hud/src/app/exodus/`, under the Exodus menu in the nav.

## Contents

- [Data Model](./data-model.md) - the tables, state checks, migration history.
- [How Processing Works](./processing.md) - claiming and leases, incremental exploration, failures and retries, finishing a job, paths.
- [API and MCP](./api.md) - REST routes and the agent's MCP tools.
- [Inventory Items and Selective Discovery](./inventory.md) - the agent's three actions, inventory item model, confidence, evidence, decisions and rediscovery.
- [Exclusion Rules and Audit](./exclusion-review-audit.md) - rules, enforcement, and the audit log.
- [UI (home-hud)](./ui.md) - the `/exodus/*` pages.
- [Decisions and Learnings](./decisions.md) - design decisions, gotchas, and lessons from building it.
- [Running, Testing and Next Steps](./operations.md) - how to run and test, and what is left.
