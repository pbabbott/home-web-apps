# Exodus - Exclusion Rules, Review and Audit

[← Project Exodus](./README.md)

Three separate concepts that must not leak into each other: **exclusion rules** govern what discovery goes into and what may be recommended; **review disposition** is a human's decision about one inventory item; **queue state** and **filesystem metadata** are unchanged by either.

## Exclusion rules

A rule is a path plus a scope, global (`source_id` null) or for one source. Paths use the usual normalization, so matching is case-insensitive and respects directory boundaries (`c:\foo` does not cover `c:\foobar`).

- `exclude_subtree` — the path and everything beneath it is excluded.
- `selective_only` — the path itself is not a backup candidate, but its descendants are still explored and judged on their own.

**Precedence** (a function of the rule set, not of query order):

1. An `exclude_subtree` rule on the path or any ancestor, global **or** source-specific, makes it `excluded`. No rule grants permission, so a source rule can never re-enable what a global rule excludes.
2. Otherwise a `selective_only` rule on exactly that path makes it `selective`. On an ancestor it has no effect.
3. Otherwise `none`.

To keep the rule set unambiguous, a path may have **one rule across a source and the global level**; a second one is 409 (and so is a duplicate for the same owner). Rules can be nested. The path of a rule cannot be edited.

**Enforcement.** `claimNextQueueItem` marks every still-queued item of the job that sits under an `exclude_subtree` rule (global or its source's) as `skipped` (`last_error: 'skipped: excluded by rule'`), in the same transaction and under the same job lock, before choosing what to hand out. That is the one place work is handed out, so it covers directories queued before the rule existed and children enqueued later. In-progress items finish. Creating or deleting a rule never deletes inventory or touches other queue items; deleting a rule only stops future skipping.

## Review

`PATCH /inventory-items/:id/review` and the bulk `POST /inventory-items/review` write only the review columns. The upsert on rediscovery never touches them (a test pins this). Rules:

- A `candidate` decision is rejected with 409 (and the blocking rule ids) when the item is `excluded` or `selective`. `not_needed` and `needs_review` are always allowed.
- Repeating the current decision is a no-op and writes no event. An omitted `note` keeps the note when the disposition is unchanged and clears it when it changes.
- Bulk is all or nothing: a missing id is 404 with `missingIds`; blocked items are 409 with `blocked`. Capped at 200 ids.

## Audit events

| `event_type`                         | Written when                                                        | `details`                                                                 |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `exclusion_rule.created`             | rule created                                                        | path, scope, reason, global                                               |
| `exclusion_rule.updated`             | scope/reason actually changed                                       | path, before, after                                                       |
| `exclusion_rule.deleted`             | rule removed                                                        | snapshot of the removed rule                                              |
| `inventory_item.review_changed`      | one item's disposition or note changed                              | path, from, to, note                                                      |
| `inventory_item.review_bulk_changed` | bulk review changed at least one item                               | disposition, note, requestedCount, unchangedCount, changed `[{id, from}]` |
| `queue_items.excluded`               | claim skipped queued items under an exclusion rule (actor `system`) | count, ruleIds, up to 100 itemIds, truncated                              |

Every event is inserted in the same transaction as the change it describes, so a rolled-back change leaves no event. Rejected requests (400/404/409) write nothing: there is deliberately no failure-logging framework. `GET /audit-events` is the only route; filters are `sourceId`, `jobId`, `inventoryItemId` (also finds bulk events that changed it), `exclusionRuleId`, `eventType`, `since`, `until`; newest first, `limit` up to 500, `before=<last event id>` for the next page.

**Actor.** There is no authentication, so callers attribute changes with optional `X-Actor-Type` (`human` | `openclaw` | `system`, default `human`) and `X-Actor-Id` headers. This is for traceability, not access control.
