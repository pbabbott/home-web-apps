# Exodus - API and MCP

[← Project Exodus](./README.md)

## REST

| Method and path                                              | Purpose                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` / `GET /sources`                                      | Register / list sources                                                                                                                                                        |
| `PATCH /sources/:id`                                         | Edit a source's name or host link                                                                                                                                              |
| `GET` / `PUT` / `DELETE /sources/:id/connection`             | How the source's files are reached (type, username, domain, share mappings, `hasPassword`). The password is encrypted on write and never returned. Human-only, not an MCP tool |
| `POST /sources/:id/connection/test`                          | Log in and list each configured share; records `lastTestOk` / `lastTestError`                                                                                                  |
| `GET /sources/:id/preview?path=`                             | Streams an image, PDF or text file for the review UI. Only paths inside an inventory item or recorded as skipped; 403 otherwise, 415 for other types, 413 over 25 MB           |
| `POST /sources/:id/discovery-jobs`                           | Start a job; queues `rootPath` as its first item                                                                                                                               |
| `GET /sources/:id/discovery-jobs`                            | A source's jobs, newest first                                                                                                                                                  |
| `GET /sources/:id/known-skips`                               | Paths and name patterns earlier jobs chose not to explore, newest reason per path/pattern; filter `pathPrefix`, `limit`                                                        |
| `POST /queue-items/:id/skip-acknowledgements`                | Human acknowledges a skip (`path`, `pattern?`); `DELETE` the same route undoes it; `GET /sources/:id/skip-acknowledgements` lists (`pathPrefix`, `limit`)                      |
| `GET /sources/:id/queue-items`                               | Queue items; filter with `?status=` and `?jobId=`                                                                                                                              |
| `POST /queue-items/:id/inventory-items`                      | Agent proposes inventory items (≤10) for the claimed directory; upsert, never touches decisions                                                                                |
| `GET /sources/:id/inventory-items`                           | Inventory items; filter `jobId`, `recommendation`, `decision`, `pathPrefix`, page with `after`/`limit`                                                                         |
| `GET /inventory-items/:id`                                   | One inventory item, plus `exclusion`                                                                                                                                           |
| `PATCH /inventory-items/:id/decision`                        | Human only: `approved` / `rejected` / `pending` with optional `note`                                                                                                           |
| `GET` / `POST /exclusion-rules`                              | List (`?sourceId=` adds global rules, `?scope=`) / create                                                                                                                      |
| `PATCH` / `DELETE /exclusion-rules/:id`                      | Change scope or reason / remove                                                                                                                                                |
| `GET /audit-events`                                          | Read-only log, newest first; filters below                                                                                                                                     |
| `GET /discovery-jobs`                                        | Jobs across all sources with source name and host; `?sourceId=`                                                                                                                |
| `GET /discovery-jobs/:id`                                    | A job with `queueCounts`                                                                                                                                                       |
| `POST /discovery-jobs/:id/{complete,cancel,fail}`            | Guarded job transitions                                                                                                                                                        |
| `GET /discovery-jobs/:id/queue-items`                        | A job's queue items; filter with `?status=`                                                                                                                                    |
| `POST /discovery-jobs/:id/queue-items`                       | Enqueue paths (must be inside the job root)                                                                                                                                    |
| `POST /discovery-jobs/:id/queue-items/claim`                 | Claim the next directory, or learn why there is none (`{ item: null, reason, retryAt }`)                                                                                       |
| `POST /queue-items/:id/{heartbeat,complete,fail,skip,retry}` | Work on a claimed item; `retry` is the human one                                                                                                                               |

The OpenAPI spec is also served as JSON at `GET /openapi.json`. Operations carry `x-mcp-tool` (the MCP tool name, when one exists) and `x-home-hud` (the home-hud page that calls the route, when one does; set via `hud` on the controller `Operation`); `/exodus/architecture` uses it to show which routes the agent can also reach.

## MCP

The agent's work loop, inventory item proposals and exclusion rules are also exposed as MCP tools at `POST /mcp` (stateless Streamable HTTP, same pattern as `gluetun-sync`; `GET`/`DELETE` return 405). The server sends the agent playbook as MCP `instructions` (`src/mcp-instructions.ts`): the three discovery actions, the confidence convention, the git guidance and the "inspect cheaply, never follow reparse points" rules, and how to handle mixed directories such as Downloads (file items for keepers, `skippedGroups` for junk). The tools call the service layer directly, reuse the REST zod schemas for input, and report `DiscoveryError`s as tool errors (`isError`) with the same details as the REST body. Policy lives once in the playbook; tool descriptions only say what a tool does. Tool **results** are compact MCP-only projections (`src/mcp-results.ts`: no normalized paths or echoed input; `claim_directory` / `claim_next_directory` return `next: stop|wait` when idle and, with a claimed item, the job (`jobId`, `sourceId`, `jobRootPath`) and `remaining` queue counts; `complete_directory` returns `queued` / `excluded` / `alreadyQueued` plus `remaining`; `list_inventory_items` returns a `next` cursor). The REST routes still return full rows.

| MCP tool                  | REST route                                   |
| ------------------------- | -------------------------------------------- |
| `list_discovery_jobs`     | `GET /discovery-jobs`                        |
| `get_discovery_job`       | `GET /discovery-jobs/:id`                    |
| `claim_next_directory`    | `POST /queue-items/claim`                    |
| `claim_directory`         | `POST /discovery-jobs/:id/queue-items/claim` |
| `heartbeat_directory`     | `POST /queue-items/:id/heartbeat`            |
| `propose_inventory_items` | `POST /queue-items/:id/inventory-items`      |
| `list_known_skips`        | `GET /sources/:id/known-skips`               |
| `list_inventory_items`    | `GET /sources/:id/inventory-items`           |
| `complete_directory`      | `POST /queue-items/:id/complete`             |
| `fail_directory`          | `POST /queue-items/:id/fail`                 |
| `skip_directory`          | `POST /queue-items/:id/skip`                 |
| `release_directory`       | `POST /queue-items/:id/release`              |
| `list_exclusion_rules`    | `GET /exclusion-rules`                       |
| `create_exclusion_rule`   | `POST /exclusion-rules` (source-scoped only) |

Deliberately **not** exposed (human-only, REST, each with a home-hud caller): retrying failed directories (one or all of a job, `POST /queue-items/:id/retry`, `POST /discovery-jobs/:id/retry-failed`), creating and editing sources, creating jobs, enqueueing arbitrary paths (job detail page), completing/cancelling/failing a job, global exclusion rules, editing or deleting rules, approving or rejecting inventory items (the agent can only recommend), the audit log. Every route has a caller: either a home-hud page or an MCP tool, and `/exodus/architecture` flags any route that has neither as `swagger only`. Rules the agent creates are attributed to actor `openclaw` in the audit log. The agent works only inside a job a human started.
