# Exodus - API and MCP

[← Project Exodus](./README.md)

## REST

| Method and path                                              | Purpose                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `POST` / `GET /sources`                                      | Register / list sources                                                                                |
| `POST /sources/:id/discovery-jobs`                           | Start a job; queues `rootPath` as its first item                                                       |
| `GET /sources/:id/discovery-jobs`                            | A source's jobs, newest first                                                                          |
| `GET /sources/:id/known-skips`                               | Paths earlier jobs chose not to explore, newest reason per path; filter `pathPrefix`, `limit`          |
| `GET /sources/:id/queue-items`                               | Queue items; filter with `?status=` and `?jobId=`                                                      |
| `POST /queue-items/:id/inventory-items`                      | Agent proposes inventory items (≤10) for the claimed directory; upsert, never touches decisions        |
| `GET /sources/:id/inventory-items`                           | Inventory items; filter `jobId`, `recommendation`, `decision`, `pathPrefix`, page with `after`/`limit` |
| `GET /inventory-items/:id`                                   | One inventory item, plus `exclusion`                                                                   |
| `PATCH /inventory-items/:id/decision`                        | Human only: `approved` / `rejected` / `pending` with optional `note`                                   |
| `GET` / `POST /exclusion-rules`                              | List (`?sourceId=` adds global rules, `?scope=`) / create                                              |
| `PATCH` / `DELETE /exclusion-rules/:id`                      | Change scope or reason / remove                                                                        |
| `GET /audit-events`                                          | Read-only log, newest first; filters below                                                             |
| `GET /discovery-jobs`                                        | Jobs across all sources with source name and host; `?sourceId=`                                        |
| `GET /discovery-jobs/:id`                                    | A job with `queueCounts`                                                                               |
| `POST /discovery-jobs/:id/{complete,cancel,fail}`            | Guarded job transitions                                                                                |
| `GET /discovery-jobs/:id/queue-items`                        | A job's queue items; filter with `?status=`                                                            |
| `POST /discovery-jobs/:id/queue-items`                       | Enqueue paths (must be inside the job root)                                                            |
| `POST /discovery-jobs/:id/queue-items/claim`                 | Claim the next directory, or learn why there is none (`{ item: null, reason, retryAt }`)               |
| `POST /queue-items/:id/{heartbeat,complete,fail,skip,retry}` | Work on a claimed item; `retry` is the human one                                                       |

## MCP

The agent's work loop, inventory item proposals and exclusion rules are also exposed as MCP tools at `POST /mcp` (stateless Streamable HTTP, same pattern as `gluetun-sync`; `GET`/`DELETE` return 405). The server sends the agent playbook as MCP `instructions` (`src/mcp-instructions.ts`): the three discovery actions, the confidence convention, the git guidance and the "inspect cheaply, never follow reparse points" rules. The tools call the service layer directly, reuse the REST zod schemas for input, and report `DiscoveryError`s as tool errors (`isError`) with the same details as the REST body.

| MCP tool                  | REST route                                   |
| ------------------------- | -------------------------------------------- |
| `list_discovery_jobs`     | `GET /discovery-jobs`                        |
| `get_discovery_job`       | `GET /discovery-jobs/:id`                    |
| `claim_directory`         | `POST /discovery-jobs/:id/queue-items/claim` |
| `heartbeat_directory`     | `POST /queue-items/:id/heartbeat`            |
| `propose_inventory_items` | `POST /queue-items/:id/inventory-items`      |
| `list_known_skips`        | `GET /sources/:id/known-skips`               |
| `list_inventory_items`    | `GET /sources/:id/inventory-items`           |
| `complete_directory`      | `POST /queue-items/:id/complete`             |
| `fail_directory`          | `POST /queue-items/:id/fail`                 |
| `skip_directory`          | `POST /queue-items/:id/skip`                 |
| `list_exclusion_rules`    | `GET /exclusion-rules`                       |
| `create_exclusion_rule`   | `POST /exclusion-rules` (source-scoped only) |

Deliberately **not** exposed (human-only, REST): retrying a failed directory, creating sources and jobs, enqueueing arbitrary paths, completing/cancelling/failing a job, global exclusion rules, editing or deleting rules, approving or rejecting inventory items (the agent can only recommend), the audit log. Rules the agent creates are attributed to actor `openclaw` in the audit log. The agent works only inside a job a human started.
