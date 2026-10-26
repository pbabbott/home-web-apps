# Exodus - Inventory Items and Selective Discovery

[← Project Exodus](./README.md)

Discovery is **selective**, not a crawl. The agent reasons about the filesystem, finds logical backup units, and presents them to a human as **inventory items**. Nothing is copied from a recommendation: only a human's explicit approval makes an inventory item eligible for the future copy workflow.

## What discovery produces

Inventory items are the **only** output of discovery (the agent proposes them; a human can also [promote a skipped path](#promoting-a-skipped-path)). There is no per-file or per-directory catalogue: the earlier per-path catalogue (its table, routes, the `record_discovered_items` tool and its browser) was removed in migration `0011`, because nothing consumed it; this entity was called "review candidate" until migration `0012` renamed it. Any per-file metadata is gathered by a future copy workflow while copying, using approved inventory items as its authorization and scope, or by the agent as `evidence` on an inventory item (for example `estimatedSizeBytes`).

| Path or situation                      | Result                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `C:\Users\Me\Pictures\Family\`         | One directory inventory item. Nothing per photo.                                                                               |
| `C:\code\my-project\` (a repository)   | One inventory item. None for `src\`, `tests\` or any file.                                                                     |
| `C:\Users\Me\Documents\tax-return.pdf` | Possibly one file inventory item.                                                                                              |
| A generated or irrelevant file         | Usually nothing; at most listed in a queue item's `skipped`.                                                                   |
| `C:\Users\Me\Downloads\` (mixed)       | Never one item. One file item per keeper, `skippedGroups` for the junk. See [Mixed directories](#mixed-directories-downloads). |

**Approval** only sets the inventory item's `decision` to `approved`. It does not recurse into the subtree or write any other rows.

## The entities

| Entity         | Role in selective discovery                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source         | The machine or root being discovered (`C:\`).                                                                                                                 |
| Discovery job  | One run over a source; owns the lifecycle.                                                                                                                    |
| Queue item     | One **bounded unit of work** (inspect this directory). Not a mirror of the filesystem. Carries `reason` (why it was queued) and `result` (summary + skipped). |
| Inventory item | The agent's proposed backup unit, with recommendation, confidence, evidence and reason, plus the human's decision.                                            |
| Exclusion rule | A persisted human policy (`selective_only`, `exclude_subtree`).                                                                                               |
| Audit event    | Append-only record of meaningful changes only.                                                                                                                |

## The agent's three actions

For each location it inspects the agent chooses one. These are discovery actions, not approvals.

1. **Skip exploration** — strong evidence the path is operating-system managed, generated, replaceable or out of scope (`C:\Windows`). List it in `complete_directory`'s `skipped` with a reason (or, for many similar direct entries, `skippedGroups`; see [Mixed directories](#mixed-directories-downloads)); it is stored on the queue item's `result`. No inventory item, no audit event, no persistent rule.
2. **Explore selectively** — may hold valuable data; more evidence needed. Pass it in `discoveredPaths` as `{ path, reason }`. Queue only promising paths, never every child.
3. **Propose an inventory item** — a coherent backup unit. Call `propose_inventory_items`. A git repository or project root is **one** inventory item; its internal folders are never proposed or queued. A standalone file can be an inventory item.

A job is finished when the dynamically created work has drained, exactly as before: it cannot complete while anything is `queued` or `in_progress`.

## Mixed directories (Downloads)

A folder like `Downloads`, `Desktop` or an old-drive dump holds thousands of unrelated loose files and folders: mostly re-downloadable junk, some irreplaceable. It is neither one backup unit nor noise, so the agent judges each entry on its own; proposing some, skipping most and exploring a few is the normal outcome. Nothing in the model is new: the same three actions apply per entry.

- **Keepers** (personal documents, scans, receipts, photos, licence keys, anything unique): one `kind: file` inventory item each. A coherent subfolder (an extracted project, a photo dump) is one directory item, or is explored for more evidence. The mixed folder itself is never proposed and never skipped wholesale.
- **Junk** (installers, ISOs, drivers, partial downloads, `name (1).ext` copies): `complete_directory.skippedGroups`, e.g. `{ pattern: "*.msi", count: 212, reason: "installers" }`. A pattern matches direct entries of the claimed directory only (no `\` or `/`, needs a wildcard and some literal text, at most 50 groups). Notable single skips still go in `skipped` (max 100). The agent does not propose `skip` items for obvious junk, which would only add review work; `recommendation: skip` is for things a human might expect to be kept.
- **Signals**, cheapest first: extension, size and dates, then the Mark-of-the-Web `Zone.Identifier` stream (`HostUrl` / `ReferrerUrl`): a public vendor URL suggests re-downloadable; an email attachment, internal host or no stream suggests unique. The agent records the signals it used in `observations` and fills `estimatedSizeBytes`.
- **Archives** are not extracted. An installer, driver or SDK by name or origin goes in `skippedGroups`; otherwise `needs_review` with an `openQuestions` entry. `contentKinds` has `installers` and `archives` for these.
- **Large directories**: the agent heartbeats (the lease is 5 minutes), proposes in batches of 10 as it goes and completes once at the end. After a crash and re-claim it calls `list_inventory_items` with `pathPrefix` set to the directory and continues; re-proposals are idempotent.
- **Uncertain** entries are `needs_review`, but groups are judged by pattern first so the reviewer is not flooded.

## Inventory item fields

Agent-owned (written by `propose_inventory_items`): `kind` (`file` | `directory`), `rootPath`, `displayName`, `summary`, `recommendation`, `confidence`, `recommendationReason`, `evidence`, `recommendedAt` / `recommendedBy`, `lastJobId`, `lastSeenAt`.

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

`git` is `null` when the path is not a repository (or was not checked); inside it, `null` means "not determined". `contentKinds` is one of `source_code`, `personal_documents`, `media`, `configuration`, `application_data`, `generated_artifacts`, `installed_software`, `installers`, `archives`, `other`. Size and file count are optional and only worth providing when cheap; never crawl just to fill them.

### API guardrails (400)

- `back_up` or `skip` with `low` confidence.
- `skip` on a git repository unless its local state is **known and clean**: `localStateKnown`, and `uncommittedChanges`, `untrackedFiles`, `unpushedCommits` all `false`, and `ignoredFilesOfNote` not `true`. A public remote alone never makes a repository disposable.

## Decisions

`PATCH /inventory-items/:id/decision` sets `pending` | `approved` | `rejected` with an optional note. Rules:

- Only a human actor may decide (`X-Actor-Type` other than `human` is 409). There is no MCP tool for it.
- Approval is refused (409 + `ruleIds`) when an exclusion rule covers the path. Rejecting is always allowed.
- Any explicit change is allowed and audited, including reversing or resetting to `pending`.
- Repeating the current decision and note is a no-op with no event. An omitted note is kept when the decision is unchanged and cleared when it changes.
- An approval normally covers the inventory item's subtree, so internal folders need no separate approval. Approving a `directory` item also skips the queued work beneath it: see [Inventorying a whole directory](#inventorying-a-whole-directory). A nested inventory item can still exist (a subproject can be a legitimate separate unit), so nesting is allowed but made visible: see [Nested inventory items](#nested-inventory-items).

## Inventorying a whole directory

Some directories are better backed up whole than explored (a synced `Google Drive`, a `Dropbox`). On a directory's page (`/exodus/jobs/[id]/directories/[itemId]`) there is an **Inventory whole directory** button. `POST /queue-items/:id/inventory-directory` (`{ note? }`, REST only, no MCP tool) approves that directory as one inventory item:

- If the agent already proposed the directory, that item is approved like any decision (`inventory_item.decision_changed`; the agent's fields are untouched). Otherwise an approved `directory` item is created (`back_up`, `high`, minimal evidence; `inventory_item.promoted` with `wholeDirectory: true`). The response says which (`created`) and how many queue items were skipped (`skippedQueueItems`).
- Human actor only (409 otherwise). A path under an exclusion rule is 409 with `blocked`.
- **Queued work inside an approved directory is skipped**, whichever way it was approved (this button, **Approve** on `/exodus/inventory`, or promote). At that moment only the directory just approved is acted on: the job's `queued` items at or beneath it become `skipped` (`lastError: skipped: covered by approved inventory item <path>`, naming the nearest approved directory that covers it), and a separate check enforces **every** approved directory when paths are enqueued or follow-ups are queued and at every claim, like exclusion rules (so work queued before another approval is skipped when the agent next claims, never as a side effect of an unrelated click). `in_progress` items finish; `completed` and `failed` items are untouched; approved files and non-approved items cover nothing. One `queue_items.inventoried` event (actor `system`) records each batch.
- It is one-way: rejecting or resetting the item later does not requeue what was skipped. Queue the paths again (job detail page) or start a new job.

## Promoting a skipped path

The agent's skips are judgments and can be wrong. A directory's page lists its skipped paths with a **Promote** button, plus a "Promote a path…" form for something a `skippedGroups` pattern hid. `POST /queue-items/:id/promote` (`{ path, kind, note?, skipReason? }`, REST only, no MCP tool) then creates an inventory item that is already `approved`: promoting is the human's approval.

- Human actor only (409 otherwise).
- The path must lie strictly inside the queue item's directory.
- Never overwrites: a path that already has an inventory item is 409 with `inventoryItemId`, so an agent row or a human decision is never replaced. A path under an exclusion rule is 409 with `blocked`, like a proposal.
- The row is `recommendation: back_up`, `confidence: high`, with minimal evidence (`sufficientInformation: false`) and a reason recording the agent's skip reason. `firstJobId` / `lastJobId` are the queue item's job, and `inventory_item.promoted` is audited.
- The queue item's `result` is left as the agent wrote it, so known skips still reports the path. A later agent proposal for the same path updates the agent fields and never the approval, as in [Rediscovery](#rediscovery).

## Acknowledging a skipped path

Reviewing skips by eye loses track of what was checked. On the job detail page each skipped path and each "skipped by pattern" row has an **Acknowledge** button: the human agrees with the skip. The headings count reviewed rows (`Skipped paths · 12 / 30 reviewed`); a promoted path counts as reviewed. The button turns into a warning-colour **Undo ack**, which takes it back.

- `POST /queue-items/:id/skip-acknowledgements` (`{ path, pattern? }`), `DELETE` the same route to undo, `GET /sources/:id/skip-acknowledgements` (`pathPrefix`, `limit`) to list. REST only, no MCP tool.
- Human actor only (409 otherwise). A plain path must lie strictly inside the queue item's directory; for a pattern skip, `path` is the directory itself.
- Idempotent. Stored in `skip_acknowledgements`, unique per `(source_id, normalized_path, pattern)`, so an acknowledgement holds for later jobs that skip the same path. The queue item's `result` is left as the agent wrote it.
- Audited as `skip.acknowledged` / `skip.unacknowledged` (path, and pattern when set), once per actual change.

## Acknowledging the on-disk contents

The directory page's **On disk** section lists what is actually in the directory (see [UI](./ui.md#directory-page)), but that listing is read live and never stored. Once a reviewer has checked that everything is accounted for, **Acknowledge** records it; **Undo ack** takes it back. A directory's green check needs this acknowledgement as well as every skip reviewed and no inventory decision pending.

- `POST /queue-items/:id/on-disk-review` (no body), `DELETE` the same route to undo, `GET /sources/:id/on-disk-reviews` (`pathPrefix`, `limit`) to list. REST only, no MCP tool.
- Human actor only (409 otherwise). Idempotent. Always available: it does not require a scan, and it does not require every entry to be covered, so a folder the SMB account cannot list can still be finished.
- Stored in `on_disk_reviews`, unique per `(source_id, normalized_path)`, so it holds for later jobs that visit the same directory. It does not expire when the contents change.
- Audited as `on_disk.reviewed` / `on_disk.unreviewed`, once per actual change.

## Nested inventory items

Proposing a path inside an existing inventory item (or above one) is **not rejected**: the agent cannot reliably tell a monorepo subproject from a repository's `src\`, and a hard rule would hang on agent-claimed `evidence.git`. Instead each result of `propose_inventory_items` carries:

- `coveredBy` — existing inventory items of the source whose root is a proper ancestor (any decision), farthest first.
- `covers` — existing inventory items beneath it (any decision), ordered by path, at most 50.

Each entry has `id`, `kind`, `rootPath`, `displayName`, `recommendation` and `decision`. The agent is told to reconsider when `coveredBy` is non-empty; a reviewer sees the same overlap. Matching is case-insensitive on path-segment boundaries (`C:\code\app` does not cover `C:\code\app2`). Batch siblings are reported to each other because the lookup runs after the upsert.

Intended rule for the future copy workflow (not implemented; nothing is inherited today): a path is covered when any ancestor inventory item is approved; a nested `rejected` inventory item is a carve-out from that approval; a nested `approved` inventory item inside an approved ancestor is redundant, so the copy workflow dedupes.

## Rediscovery

Identity is `(source, normalized root path)` (case-insensitive). Re-proposing the same path, in the same job or a later one:

- updates the agent fields when something differs (evidence is compared ignoring key order; a casing-only difference in `rootPath` is not a change);
- never touches `decision*` — a human decision is never reset or silently invalidated, even if the new recommendation disagrees (the `recommendation_changed` event records the decision in force);
- identical re-proposals only refresh `lastJobId` / `lastSeenAt`, with no audit event.

A human can compare `recommendedAt` with `decidedAt` to notice that the agent changed its mind after a decision.

## Exclusion rules versus agent judgments

Rules are policy; skips are per-run judgments. The agent skipping `C:\Windows` does not create a rule — create one only when a human policy is intended.

- `exclude_subtree` — the path and its descendants are not explored or backed up. A global rule beats any source rule.
- `selective_only` — the path itself cannot be an inventory item, but descendants are explored and may be.

Enforcement: proposing an inventory item under an `exclude_subtree` rule, or exactly on a `selective_only` path, rejects the whole batch with 409 and a `blocked` list. Follow-up work under an `exclude_subtree` rule is marked `skipped` the moment it is enqueued (`complete_directory` and the human enqueue route), and every claim rechecks, in case a rule was added after work was queued. Adding a rule never deletes inventory items or their history; an existing inventory item that becomes covered can no longer be approved.

## Audit

| `event_type`                            | Written when                                            | `details`                                 |
| --------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `inventory_item.created`                | an inventory item is first proposed (actor `openclaw`)  | path, recommendation, confidence          |
| `inventory_item.recommendation_changed` | recommendation or confidence changed on rediscovery     | path, from, to, reason, decision in force |
| `inventory_item.decision_changed`       | a human approves, rejects, changes or resets a decision | path, from, to, note, recommendation      |
| `inventory_item.promoted`               | a human promotes a skipped path (actor `human`)         | path, kind, skipReason                    |
| `skip.acknowledged`                     | a human acknowledges a skipped path (actor `human`)     | path, pattern (when set)                  |
| `skip.unacknowledged`                   | a human takes an acknowledgement back                   | path, pattern (when set)                  |
| `on_disk.reviewed`                      | a human acknowledges a directory's on-disk contents     | path                                      |
| `on_disk.unreviewed`                    | a human takes that acknowledgement back                 | path                                      |

Each is written in the same transaction as its change. Listing a directory, skipping a path, or an unchanged re-proposal writes nothing. Filter with `GET /audit-events?inventoryItemId=`.

## Remembering skips across jobs

`complete_directory`'s `skipped` is stored on that queue item, which belongs to one job. So a later job could re-inspect `C:\Windows`. `GET /sources/:id/known-skips` (MCP `list_known_skips`) gathers the `skipped` entries from all of the source's earlier jobs: one row per path (case-insensitive), the newest reason and spelling, which job recorded it and when, ordered by path, with `pathPrefix` and `limit` (default 200, max 1000). The agent playbook tells it to call this, with the job root as `pathPrefix`, at the start of a run.

Pattern skips (`skippedGroups`) are listed too, with `path` set to the directory, plus `pattern` and `count`; one row per directory and pattern (case-insensitive), newest reason wins, and the `pathPrefix` filter applies to the directory. A pattern entry covers the matching direct children of `path`, not `path` itself. It is derived from the stored results, not a table or a rule: a skip stays a per-run judgment. Nothing it lists blocks queueing or proposing a path, the agent may revisit one if its reason looks wrong, and only a human policy belongs in an exclusion rule. If a skip should be permanent, create a source-scoped rule instead.

## Prerequisite: filesystem access

This API grants no filesystem access. The agent needs its own read-only access to the source (a separately configured mechanism) to list directories and run `git status`. Nothing here assumes it exists. The agent should prefer metadata, names and git signals over reading file contents, never follow symlinks, junctions or other reparse points, and stay inside the job's root.

## Limits and follow-ups

- Guardrails check the shape of the evidence, not whether it is true.
- Stale items: a file deleted from Downloads keeps its inventory item; only `lastSeenAt` hints that no later job saw it. Nothing detects or retires them yet.
- Pattern skips are not matched against anything server-side: the pattern and count are the agent's claim, kept for later runs and humans.
- No inheritance or override semantics between nested inventory items; overlap is only reported (see [Nested inventory items](#nested-inventory-items)).
- The review UI ([`/exodus/inventory`](./ui.md)) handles one inventory item at a time, with no bulk approve and no free-text search. Mixed directories make this the most painful gap: a Downloads folder can yield dozens of file items. There is no copy workflow yet; it will read approved inventory items from `GET /sources/:id/inventory-items?decision=approved`.
