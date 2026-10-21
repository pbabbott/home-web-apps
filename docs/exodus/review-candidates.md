# Exodus - Review Candidates and Selective Discovery

[← Project Exodus](./README.md)

Discovery is **selective**, not a crawl. The agent reasons about the filesystem, finds logical backup units, and presents them to a human as **review candidates**. Nothing is copied from a recommendation: only a human's explicit approval makes a candidate eligible for the future copy workflow.

## What discovery produces

Review candidates are the **only** output of discovery. There is no per-file or per-directory catalogue: the earlier inventory subdomain (`inventory_items`, its routes, the `record_discovered_items` tool and the inventory browser) was removed in migration `0011`, because nothing consumed it. Any per-file metadata is gathered by a future copy workflow while copying, using approved candidates as its authorization and scope, or by the agent as `evidence` on a candidate (for example `estimatedSizeBytes`).

| Path or situation                      | Result                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `C:\Users\Me\Pictures\Family\`         | One directory candidate. Nothing per photo.                  |
| `C:\code\my-project\` (a repository)   | One candidate. None for `src\`, `tests\` or any file.        |
| `C:\Users\Me\Documents\tax-return.pdf` | Possibly one file candidate.                                 |
| A generated or irrelevant file         | Usually nothing; at most listed in a queue item's `skipped`. |

**Approval** only sets the candidate's `decision` to `approved`. It does not recurse into the subtree or write any other rows.

## The entities

| Entity           | Role in selective discovery                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source           | The machine or root being discovered (`C:\`).                                                                                                                 |
| Discovery job    | One run over a source; owns the lifecycle.                                                                                                                    |
| Queue item       | One **bounded unit of work** (inspect this directory). Not a mirror of the filesystem. Carries `reason` (why it was queued) and `result` (summary + skipped). |
| Review candidate | The agent's proposed backup unit, with recommendation, confidence, evidence and reason, plus the human's decision.                                            |
| Exclusion rule   | A persisted human policy (`selective_only`, `exclude_subtree`).                                                                                               |
| Audit event      | Append-only record of meaningful changes only.                                                                                                                |

## The agent's three actions

For each location it inspects the agent chooses one. These are discovery actions, not approvals.

1. **Skip exploration** — strong evidence the path is operating-system managed, generated, replaceable or out of scope (`C:\Windows`). List it in `complete_directory`'s `skipped` with a reason; it is stored on the queue item's `result`. No candidate, no audit event, no persistent rule.
2. **Explore selectively** — may hold valuable data; more evidence needed. Pass it in `discoveredPaths` as `{ path, reason }`. Queue only promising paths, never every child.
3. **Propose a candidate** — a coherent backup unit. Call `propose_review_candidates`. A git repository or project root is **one** candidate; its internal folders are never proposed or queued. A standalone file can be a candidate.

A job is finished when the dynamically created work has drained, exactly as before: it cannot complete while anything is `queued` or `in_progress`.

## Candidate fields

Agent-owned (written by `propose_review_candidates`): `kind` (`file` | `directory`), `rootPath`, `displayName`, `summary`, `recommendation`, `confidence`, `recommendationReason`, `evidence`, `recommendedAt` / `recommendedBy`, `lastJobId`, `lastSeenAt`.

Human-owned (written only by the decision route): `decision`, `decisionNote`, `decidedAt`, `decidedBy`.

Provenance: `firstJobId` is the job that created it and never changes; `lastJobId` is the most recent job that proposed it. `recommendedAt` moves only when the recommendation, confidence or reason changes.

### Recommendation

- `back_up` — evidence suggests unique or valuable material.
- `skip` — strong evidence it is irrelevant, reproducible or safely replaceable.
- `needs_review` — not enough evidence for a confident call.

### Confidence

`low` | `medium` | `high`. Not a calibrated probability.

- `high` — direct evidence settles it.
- `medium` — strong signals with minor unknowns.
- `low` — a guess. A `low` recommendation must be `needs_review`.

### Evidence

Concise and grounded. `observations` are facts the agent verified; unknowns go in `openQuestions`.

```json
{
  "contentKinds": ["source_code"],
  "git": {
    "remoteUrl": "https://github.com/me/project-a",
    "remoteVisibility": "private",
    "localStateKnown": true,
    "uncommittedChanges": true,
    "untrackedFiles": false,
    "unpushedCommits": false,
    "ignoredFilesOfNote": false
  },
  "reproducible": "no",
  "sufficientInformation": true,
  "observations": ["git status lists 4 modified files"],
  "openQuestions": [],
  "estimatedSizeBytes": 1048576
}
```

`git` is `null` when the path is not a repository (or was not checked); inside it, `null` means "not determined". `contentKinds` is one of `source_code`, `personal_documents`, `media`, `configuration`, `application_data`, `generated_artifacts`, `installed_software`, `other`. Size and file count are optional and only worth providing when cheap; never crawl just to fill them.

### API guardrails (400)

- `back_up` or `skip` with `low` confidence.
- `skip` on a git repository unless its local state is **known and clean**: `localStateKnown`, and `uncommittedChanges`, `untrackedFiles`, `unpushedCommits` all `false`, and `ignoredFilesOfNote` not `true`. A public remote alone never makes a repository disposable.

## Decisions

`PATCH /review-candidates/:id/decision` sets `pending` | `approved` | `rejected` with an optional note. Rules:

- Only a human actor may decide (`X-Actor-Type` other than `human` is 409). There is no MCP tool for it.
- Approval is refused (409 + `ruleIds`) when an exclusion rule covers the path. Rejecting is always allowed.
- Any explicit change is allowed and audited, including reversing or resetting to `pending`.
- Repeating the current decision and note is a no-op with no event. An omitted note is kept when the decision is unchanged and cleared when it changes.
- An approval normally covers the candidate's subtree, so internal folders need no separate approval. A nested candidate can still exist (a subproject can be a legitimate separate unit), so nesting is allowed but made visible: see [Nested candidates](#nested-candidates).

## Nested candidates

Proposing a path inside an existing candidate (or above one) is **not rejected**: the agent cannot reliably tell a monorepo subproject from a repository's `src\`, and a hard rule would hang on agent-claimed `evidence.git`. Instead each result of `propose_review_candidates` carries:

- `coveredBy` — existing candidates of the source whose root is a proper ancestor (any decision), farthest first.
- `covers` — existing candidates beneath it (any decision), ordered by path, at most 50.

Each entry has `id`, `kind`, `rootPath`, `displayName`, `recommendation` and `decision`. The agent is told to reconsider when `coveredBy` is non-empty; a reviewer sees the same overlap. Matching is case-insensitive on path-segment boundaries (`C:\code\app` does not cover `C:\code\app2`). Batch siblings are reported to each other because the lookup runs after the upsert.

Intended rule for the future copy workflow (not implemented; nothing is inherited today): a path is covered when any ancestor candidate is approved; a nested `rejected` candidate is a carve-out from that approval; a nested `approved` candidate inside an approved ancestor is redundant, so the copy workflow dedupes.

## Rediscovery

Identity is `(source, normalized root path)` (case-insensitive). Re-proposing the same path, in the same job or a later one:

- updates the agent fields when something differs (evidence is compared ignoring key order; a casing-only difference in `rootPath` is not a change);
- never touches `decision*` — a human decision is never reset or silently invalidated, even if the new recommendation disagrees (the `recommendation_changed` event records the decision in force);
- identical re-proposals only refresh `lastJobId` / `lastSeenAt`, with no audit event.

A human can compare `recommendedAt` with `decidedAt` to notice that the agent changed its mind after a decision.

## Exclusion rules versus agent judgments

Rules are policy; skips are per-run judgments. The agent skipping `C:\Windows` does not create a rule — create one only when a human policy is intended.

- `exclude_subtree` — the path and its descendants are not explored or backed up. A global rule beats any source rule.
- `selective_only` — the path itself cannot be a candidate, but descendants are explored and may be.

Enforcement: proposing a candidate under an `exclude_subtree` rule, or exactly on a `selective_only` path, rejects the whole batch with 409 and a `blocked` list. Follow-up work under an `exclude_subtree` rule is marked `skipped` the moment it is enqueued (`complete_directory` and the human enqueue route), and every claim rechecks, in case a rule was added after work was queued. Adding a rule never deletes candidates or their history; an existing candidate that becomes covered can no longer be approved.

## Audit

| `event_type`                              | Written when                                            | `details`                                 |
| ----------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `review_candidate.created`                | a candidate is first proposed (actor `openclaw`)        | path, recommendation, confidence          |
| `review_candidate.recommendation_changed` | recommendation or confidence changed on rediscovery     | path, from, to, reason, decision in force |
| `review_candidate.decision_changed`       | a human approves, rejects, changes or resets a decision | path, from, to, note, recommendation      |

Each is written in the same transaction as its change. Listing a directory, skipping a path, or an unchanged re-proposal writes nothing. Filter with `GET /audit-events?reviewCandidateId=`.

## Remembering skips across jobs

`complete_directory`'s `skipped` is stored on that queue item, which belongs to one job. So a later job could re-inspect `C:\Windows`. `GET /sources/:id/known-skips` (MCP `list_known_skips`) gathers the `skipped` entries from all of the source's earlier jobs: one row per path (case-insensitive), the newest reason and spelling, which job recorded it and when, ordered by path, with `pathPrefix` and `limit` (default 200, max 1000). The agent playbook tells it to call this, with the job root as `pathPrefix`, at the start of a run.

It is derived from the stored results, not a table or a rule: a skip stays a per-run judgment. Nothing it lists blocks queueing or proposing a path, the agent may revisit one if its reason looks wrong, and only a human policy belongs in an exclusion rule. If a skip should be permanent, create a source-scoped rule instead.

## Prerequisite: filesystem access

This API grants no filesystem access. The agent needs its own read-only access to the source (a separately configured mechanism) to list directories and run `git status`. Nothing here assumes it exists. The agent should prefer metadata, names and git signals over reading file contents, never follow symlinks, junctions or other reparse points, and stay inside the job's root.

## Limits and follow-ups

- Guardrails check the shape of the evidence, not whether it is true.
- No inheritance or override semantics between nested candidates; overlap is only reported (see [Nested candidates](#nested-candidates)).
- The review UI ([`/exodus/candidates`](./ui.md)) handles one candidate at a time, with no bulk approve and no free-text search. There is no copy workflow yet; it will read approved candidates from `GET /sources/:id/review-candidates?decision=approved`.
