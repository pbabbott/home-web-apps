# Exodus Backup: Design (proposal)

[← Project Exodus](../README.md)

**Nothing in this folder is built.** It plans copying approved inventory items to an NFS destination. It lives apart from the rest of `docs/exodus/`, which describes what exists, so a proposal is not mistaken for a fact about the system.

- [Facts](./facts.md) - what you confirmed, and what was observed in the environment. Read first.
- [Plan](./plan.md) - the data model, behaviour, API, and the milestones (M0 to M6) to build, each sized for its own session, branch and PR.

As milestones land, their facts move into the main Exodus docs and the matching part of the plan is deleted. When the last one ships, delete this folder. The question-and-answer history that produced these two files is in git: the files under `docs/exodus/backup-design/` at commit `b83f254f` (`git show b83f254f:docs/exodus/backup-design/design.md`).
