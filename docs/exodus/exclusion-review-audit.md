# Exodus - Exclusion Rules and Audit

[← Project Exodus](./README.md)

Three separate concepts that must not leak into each other: **exclusion rules** govern what discovery goes into and what may be recommended; a **review decision** is a human's call about one [review candidate](./review-candidates.md); **queue state** and **filesystem metadata** are unchanged by either.

## Exclusion rules

A rule is a path plus a scope, global (`source_id` null) or for one source. Paths use the usual normalization, so matching is case-insensitive and respects directory boundaries (`c:\foo` does not cover `c:\foobar`).

- `exclude_subtree` — the path and everything beneath it is excluded.
- `selective_only` — the path itself is not a backup candidate, but its descendants are still explored and judged on their own.

**Precedence** (a function of the rule set, not of query order):

1. An `exclude_subtree` rule on the path or any ancestor, global **or** source-specific, makes it `excluded`. No rule grants permission, so a source rule can never re-enable what a global rule excludes.
2. Otherwise a `selective_only` rule on exactly that path makes it `selective`. On an ancestor it has no effect.
3. Otherwise `none`.

To keep the rule set unambiguous, a path may have **one rule across a source and the global level**; a second one is 409 (and so is a duplicate for the same owner). Rules can be nested. The path of a rule cannot be edited.

**Enforcement.** `claimNextQueueItem` marks every still-queued item of the job that sits under an `exclude_subtree` rule (global or its source's) as `skipped` (`last_error: 'skipped: excluded by rule'`), in the same transaction and under the same job lock, before choosing what to hand out. That is the one place work is handed out, so it covers directories queued before the rule existed and children enqueued later. In-progress items finish. Newly queued work is checked the same way when it is enqueued (so it lands `skipped` immediately). Creating or deleting a rule never deletes candidates or other queue items; deleting a rule only stops future skipping. Candidates under an exclusion rule cannot be proposed or approved (see [Review Candidates](./review-candidates.md)).

## Review

Human review is a decision on a review candidate; see [Review Candidates](./review-candidates.md). Inventory items, and the review routes that went with them, no longer exist (migration `0010` moved their decisions onto candidates and `0011` removed inventory).

## Audit events

| `event_type`                              | Written when                                                        | `details`                                    |
| ----------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `exclusion_rule.created`                  | rule created                                                        | path, scope, reason, global                  |
| `exclusion_rule.updated`                  | scope/reason actually changed                                       | path, before, after                          |
| `exclusion_rule.deleted`                  | rule removed                                                        | snapshot of the removed rule                 |
| `review_candidate.created`                | an agent first proposes a candidate                                 | path, recommendation, confidence             |
| `review_candidate.recommendation_changed` | recommendation or confidence changed on rediscovery                 | path, from, to, reason, decision             |
| `review_candidate.decision_changed`       | a human approves, rejects, changes or resets a decision             | path, from, to, note, recommendation         |
| `queue_items.excluded`                    | claim skipped queued items under an exclusion rule (actor `system`) | count, ruleIds, up to 100 itemIds, truncated |

Every event is inserted in the same transaction as the change it describes, so a rolled-back change leaves no event. Rejected requests (400/404/409) write nothing: there is deliberately no failure-logging framework. `GET /audit-events` is the only route; filters are `sourceId`, `jobId`, `exclusionRuleId`, `reviewCandidateId`, `eventType`, `since`, `until`; newest first, `limit` up to 500, `before=<last event id>` for the next page.

**Actor.** There is no authentication, so callers attribute changes with optional `X-Actor-Type` (`human` | `openclaw` | `system`, default `human`) and `X-Actor-Id` headers. This is for traceability, not access control.
