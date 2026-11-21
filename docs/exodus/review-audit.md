# Exodus - Review and Audit

[← Project Exodus](./README.md)

A **review decision** is a human's call about one [inventory item](./inventory.md); **queue state** and **filesystem metadata** are unchanged by it.

## Review

Human review is a decision on an inventory item; see [Inventory Items](./inventory.md). The older per-path catalogue and its review routes no longer exist (migration `0010` moved their decisions onto review candidates, `0011` removed the catalogue, and `0012` renamed review candidates to inventory items).

## Audit events

| `event_type`                            | Written when                                                       | `details`                                             |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `inventory_item.created`                | an agent first proposes an inventory item                          | path, recommendation, confidence                      |
| `inventory_item.recommendation_changed` | recommendation or confidence changed on rediscovery                | path, from, to, reason, decision                      |
| `inventory_item.decision_changed`       | a human approves, rejects, changes or resets a decision            | path, from, to, note, recommendation                  |
| `queue_items.inventoried`               | queued items skipped inside an approved directory (actor `system`) | count, inventoryItemIds, up to 100 itemIds, truncated |
| `inventory_item.promoted`               | a human promotes a skipped path or adds a whole directory          | path, kind, skipReason, wholeDirectory?               |
| `on_disk.reviewed`                      | a human acknowledges a directory's on-disk contents                | path                                                  |
| `on_disk.unreviewed`                    | a human takes that acknowledgement back                            | path                                                  |

Every event is inserted in the same transaction as the change it describes, so a rolled-back change leaves no event. Rejected requests (400/404/409) write nothing: there is deliberately no failure-logging framework. `GET /audit-events` is the only route; filters are `sourceId`, `jobId`, `inventoryItemId`, `eventType`, `since`, `until`; newest first, `limit` up to 500, `before=<last event id>` for the next page.

**Actor.** There is no authentication, so callers attribute changes with optional `X-Actor-Type` (`human` | `openclaw` | `system`, default `human`) and `X-Actor-Id` headers. This is for traceability, not access control.

Exclusion rules existed until migration `0018`, which removed the feature (table, `audit_events.exclusion_rule_id`, and the `exclusion_rule.*` and `queue_items.excluded` events).
