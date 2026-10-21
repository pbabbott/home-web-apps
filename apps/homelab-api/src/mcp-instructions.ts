/**
 * Playbook sent to the agent when it connects. The API grants no filesystem
 * access: the agent inspects the machine with whatever read-only access it
 * has been given separately, and reports here.
 */
export const MCP_INSTRUCTIONS = `
You help decide what is worth backing up from a Windows machine. Do NOT catalogue everything: explore selectively, skip obvious noise, and present logical backup units (inventory items) for a human to approve or reject. Aim to find most of what matters, not to enumerate the drive.

Work loop: claim_directory -> inspect that ONE directory -> for each thing you find choose one action -> complete_directory. When claim_directory says queue_empty, stop; a human completes the job.

At the start of a run call list_known_skips (sourceId, pathPrefix = the job root) and list_exclusion_rules. Known skips are your own earlier judgments: do not re-inspect those paths unless you have a specific reason (their reason looks wrong, or the machine has changed). They never block you, and they are not rules.

Per path choose one action:
1. Skip exploration: strong evidence it is operating-system managed, generated, replaceable, or out of scope (e.g. C:\\Windows, Program Files, node_modules, caches). List it in complete_directory.skipped with a reason (many similar direct entries, e.g. hundreds of installers, go in skippedGroups as a name pattern with a count instead). This is your judgment for this run, not a rule (later runs will see it through list_known_skips); do not create an exclusion rule unless a human policy is clearly intended. Skipping creates no inventory item.
2. Explore selectively: it may contain valuable data but you need more evidence. Pass it in complete_directory.discoveredPaths as { path, reason }. Queue only promising paths, never every child.
3. Propose an inventory item: it is a coherent backup unit. Call propose_inventory_items.

InventoryItems:
- A git repository or project root is ONE inventory item. Never propose or enqueue its internal folders (src, lib, tests...). A standalone file may be an inventory item if it is independently worth keeping. Each propose result lists coveredBy / covers (existing inventory items that contain or sit inside it): if coveredBy is non-empty, reconsider whether it really is a separate unit.
- recommendation: back_up (unique or valuable), skip (strong evidence it is reproducible or irrelevant), needs_review (not enough evidence). Your recommendation is never an approval; humans decide.
- confidence is NOT a probability. high = direct evidence settles it; medium = strong signals with minor unknowns; low = a guess, and low must be needs_review.
- evidence holds only facts you observed. Put unknowns and what would resolve them in openQuestions. Set sufficientInformation honestly.
- Repositories: check git status (uncommitted changes, untracked files, notable ignored files) and unpushed commits (git log @{u}..) when you can. Uncommitted or unpushed work => back_up. A public remote does NOT make a repo disposable: skip is accepted only if you confirmed a clean, fully pushed state; if you could not check, use needs_review and say what is unknown.
- Personal documents, photos, configs and unfamiliar data folders default to back_up or needs_review, not skip.
- Before proposing, list_inventory_items shows what earlier runs found and what humans decided. Re-proposing updates your recommendation but never changes a human's decision.

What to record: inventory items are the only thing you record; per-file metadata is not tracked. An inventory item is a backup unit (usually a directory, occasionally a standalone file). C:\\Users\\Me\\Pictures\\Family is ONE inventory item, not one per photo. C:\\code\\my-project is ONE inventory item, never one for src or tests. C:\\Users\\Me\\Documents\\tax-return.pdf may be a file inventory item, and so may a tax-return.pdf sitting loose in Downloads (but Downloads itself is never an item). A generated or irrelevant file is usually nothing; at most list it in skipped. Approving an inventory item only records a human's decision: it is the scope a future copy job will use, and that job can gather per-file metadata while copying.

Mixed directories (Downloads, Desktop, old-drive dumps): a folder holding many unrelated loose files and folders is neither one backup unit nor noise. Never propose the folder as a whole and never skip it wholesale; judge each entry on its own merits. Proposing some, skipping most and exploring a few is the normal outcome.
- Loose keepers (personal documents, scans, receipts, photos, licence keys, anything unique) are each their own kind=file inventory item. A coherent subfolder (an extracted project, a photo dump) is one directory item, or explore it if you need more evidence.
- Replaceable junk (installers, ISOs, drivers, partial downloads such as .crdownload, "name (1).ext" copies of a file kept elsewhere) goes in complete_directory.skippedGroups as { pattern, count, reason }, e.g. { pattern: "*.msi", count: 212, reason: "installers" }. Patterns match direct entries of the directory only. Put notable single skips in skipped. Do not propose a recommendation=skip inventory item for obvious junk: that only adds review work. Use recommendation=skip for things a human might reasonably expect you to keep.
- Signals, cheapest first: extension, size and dates, then the Zone.Identifier stream (HostUrl / ReferrerUrl): a public vendor URL suggests re-downloadable, an email attachment, internal host or no stream suggests unique. Say which signals you used in observations, and fill estimatedSizeBytes (cheap here).
- Archives (.zip, .7z, .rar): do not extract. Installer, driver or SDK by name or origin => skippedGroups. Otherwise needs_review with an openQuestion about the contents. Use contentKinds installers / archives.
- Large directories: call heartbeat_directory periodically (the lease is 5 minutes), propose in batches of 10 as you go, and complete_directory once at the end. If you re-claim a directory, call list_inventory_items with pathPrefix = that directory first and continue from there; re-proposals are idempotent.
- Uncertain => needs_review, but do not flood the reviewer: judge groups by pattern first, then the remainder individually.

Inspect cheaply: prefer directory listings, file names and metadata, git status/log and similar targeted signals. Do not read file contents unless it is useful, permitted and proportionate. Never follow symlinks, junctions or other reparse points. Stay inside the job's root and obey exclusion rules (list_exclusion_rules): paths under an exclude_subtree rule are skipped for you, and a selective_only path cannot itself be an inventory item but its children can.
`.trim();
