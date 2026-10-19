# Exodus - API and MCP

[← Project Exodus](./README.md)

## REST

| Method and path                                              | Purpose                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `POST` / `GET /sources`                                      | Register / list sources                                                                                           |
| `POST /sources/:id/discovery-jobs`                           | Start a job; queues `rootPath` as its first item and records it as an inventory directory                         |
| `GET /sources/:id/discovery-jobs`                            | A source's jobs, newest first                                                                                     |
| `GET /sources/:id/queue-items`                               | Queue items; filter with `?status=` and `?jobId=`                                                                 |
| `GET /sources/:id/inventory-items`                           | Inventory; filter `jobId`, `itemType`, `reviewDisposition`, `parentPath`, `pathPrefix`, page with `after`/`limit` |
| `GET /inventory-items/:id`                                   | One item, plus `exclusion` (`none` / `selective` / `excluded` and the deciding rule ids)                          |
| `PATCH /inventory-items/:id/review`                          | Set `disposition` and optional `note`                                                                             |
| `POST /inventory-items/review`                               | Same decision for up to 200 `ids`, all or nothing                                                                 |
| `GET` / `POST /exclusion-rules`                              | List (`?sourceId=` adds global rules, `?scope=`) / create                                                         |
| `PATCH` / `DELETE /exclusion-rules/:id`                      | Change scope or reason / remove                                                                                   |
| `GET /audit-events`                                          | Read-only log, newest first; filters below                                                                        |
| `GET /discovery-jobs`                                        | Jobs across all sources with source name and host; `?sourceId=`                                                   |
| `GET /discovery-jobs/:id`                                    | A job with `queueCounts`                                                                                          |
| `POST /discovery-jobs/:id/{complete,cancel,fail}`            | Guarded job transitions                                                                                           |
| `GET /discovery-jobs/:id/queue-items`                        | A job's queue items; filter with `?status=`                                                                       |
| `POST /discovery-jobs/:id/queue-items`                       | Enqueue paths (must be inside the job root)                                                                       |
| `POST /discovery-jobs/:id/queue-items/claim`                 | Claim the next directory, or learn why there is none (`{ item: null, reason, retryAt }`)                          |
| `POST /queue-items/:id/inventory-items`                      | Record files and directories found in the claimed directory                                                       |
| `POST /queue-items/:id/{heartbeat,complete,fail,skip,retry}` | Work on a claimed item; `retry` is the human one                                                                  |

## MCP

The agent's work loop and exclusion rules are also exposed as MCP tools at `POST /mcp` (stateless Streamable HTTP, same pattern as `gluetun-sync`; `GET`/`DELETE` return 405). The tools call the service layer directly, reuse the REST zod schemas for input, and report `DiscoveryError`s as tool errors (`isError`) with the same details as the REST body.

| MCP tool                  | REST route                                   |
| ------------------------- | -------------------------------------------- |
| `list_discovery_jobs`     | `GET /discovery-jobs`                        |
| `get_discovery_job`       | `GET /discovery-jobs/:id`                    |
| `claim_directory`         | `POST /discovery-jobs/:id/queue-items/claim` |
| `heartbeat_directory`     | `POST /queue-items/:id/heartbeat`            |
| `record_discovered_items` | `POST /queue-items/:id/inventory-items`      |
| `complete_directory`      | `POST /queue-items/:id/complete`             |
| `fail_directory`          | `POST /queue-items/:id/fail`                 |
| `skip_directory`          | `POST /queue-items/:id/skip`                 |
| `retry_directory`         | `POST /queue-items/:id/retry`                |
| `list_exclusion_rules`    | `GET /exclusion-rules`                       |
| `create_exclusion_rule`   | `POST /exclusion-rules` (source-scoped only) |

Deliberately **not** exposed (human-only, REST): creating sources and jobs, enqueueing arbitrary paths, completing/cancelling/failing a job, global exclusion rules, editing or deleting rules, review, the audit log, and the list/inventory read routes. Rules the agent creates are attributed to actor `openclaw` in the audit log. The agent works only inside a job a human started.
