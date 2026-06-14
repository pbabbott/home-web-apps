---
name: code-review
description: Sensibility and complexity review of pending changes. Use when the user wants to audit a diff or changeset for unnecessary complexity, poor comments, or fragile constraints.
allowed-tools: Bash, Read
---

Review the pending changes (or the files specified by the user) for the issues
below. Report findings grouped by severity. Propose concrete fixes; don't just
describe problems.

## What to look for

### Unnecessary complexity

- Code that reimplements something the framework or stdlib already provides
- Abstractions added speculatively (no current caller, no current need)
- Workarounds that outlived the problem they solved
- Config or build logic that belongs in a simpler place (e.g. hand-rolled .env
  parsers when the framework auto-loads .env files)

### Comment quality

Default is no comments. Flag comments that:

- Describe WHAT the code does (readable from the code itself) — remove them
- Are stale (describe behavior that no longer exists)
- Are placeholders or TODOs with no owner

Keep comments that explain WHY: a hidden constraint, a non-obvious invariant,
a workaround for a specific upstream bug, or behavior that would surprise a
future reader.

### Fragile constraints

Things that will silently break if a future developer removes them without
knowing why:

- Flags in scripts that seem optional but are required (e.g. `--webpack` to
  make `assetPrefix` work in Next.js dev)
- Order dependencies between steps
- Version pins with no explanation
- Feature flags left permanently on/off

For each fragile constraint, check: is the WHY documented near the code?
If not, that's a finding.

### Duplication

- Logic copied across files that should share a single source of truth
- Constants defined in multiple places

### Over-engineering

- Error handling for cases that cannot happen at runtime
- Validation of data that is already trusted (internal APIs, typed inputs)
- Backwards-compatibility shims for code that has no other callers

## How to report

For each finding:

- State the file and line range
- Classify: **complexity**, **comment**, **fragile**, **duplication**, or **over-engineering**
- One-sentence description of the issue
- Proposed fix (inline if small, described if larger)

End with a summary: total findings, which are safe to fix now vs. need
discussion.
