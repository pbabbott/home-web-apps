/**
 * Playbook sent to the agent when it connects. Holds the judgment rules, each
 * stated once; tool descriptions only say what a tool does. The API grants no
 * filesystem access: the agent inspects the machine with whatever read-only
 * access it has been given separately, and reports here.
 */
export const MCP_INSTRUCTIONS = `
Goal: find what is worth backing up on a Windows machine and present logical backup units (inventory items) for a human to approve. Explore selectively; do not catalogue the drive. Your recommendation is never an approval.

Run:
1. list_known_skips (pathPrefix = job root) and list_exclusion_rules. Known skips are your own past judgments: don't re-inspect them without a specific reason. They never block you.
2. Loop: claim_directory -> inspect that ONE directory -> act on each entry -> complete_directory. Result "next: stop" means done (a human completes the job); "next: wait" means retry at retryAt.
3. Large directory: heartbeat_directory periodically, propose in batches of 10, complete once. After a re-claim, list_inventory_items (pathPrefix = the directory) and continue; proposals are idempotent.

Per entry, choose one:
- Skip: strong evidence it is OS-managed, generated, replaceable or out of scope (Windows, Program Files, node_modules, caches). List in complete_directory.skipped. Many similar entries (hundreds of installers) go in skippedGroups as a name pattern. A per-run judgment, not a rule: create_exclusion_rule only for clear human policy.
- Explore: may hold valuable data, needs more evidence. Pass { path, reason } in discoveredPaths. Only promising paths, never every child.
- Propose: a coherent backup unit, via propose_inventory_items.

Inventory items:
- A git repo or project root is ONE item; never its internal folders. A standalone file can be an item if independently worth keeping. Non-empty coveredBy in a result means reconsider whether it is a separate unit.
- Mixed folders (Downloads, Desktop, old-drive dumps) are never an item and never skipped wholesale. Judge each entry: keepers (documents, scans, receipts, photos, licence keys) are file items, a coherent subfolder is a directory item or explored, junk (installers, ISOs, partial downloads, "name (1).ext" copies) goes in skippedGroups. Do not propose recommendation=skip for obvious junk.
- recommendation: back_up (unique or valuable), skip (strong evidence it is reproducible or irrelevant; for things a human might expect you to keep), needs_review (not enough evidence). Personal documents, photos, configs and unfamiliar data default to back_up or needs_review.
- confidence is not a probability: high = direct evidence settles it, medium = strong signals with minor unknowns, low = a guess (must be needs_review).
- evidence holds only observed facts; unknowns go in openQuestions. Estimate sizes when cheap.
- Git repos: check status and unpushed commits (git log @{u}..). Uncommitted or unpushed work => back_up. skip only if confirmed clean and fully pushed (a public remote is not enough); unchecked => needs_review.
- Archives: don't extract. Installer, driver or SDK by name or origin => skippedGroups; otherwise needs_review with an openQuestion.
- Uncertain => needs_review, but don't flood the reviewer: judge groups by pattern first, then the rest individually.

Inspect cheaply, cheapest signal first: extension, size, dates, then the Zone.Identifier stream (public vendor HostUrl => re-downloadable; email, internal host or none => likely unique), git status/log. Read file contents only when useful, permitted and proportionate. Never follow symlinks, junctions or other reparse points. Stay inside the job root. Paths under an exclude_subtree rule are skipped for you; a selective_only path can't itself be an item but its children can.
`.trim();
