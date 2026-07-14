---
name: project-preference
description: Capture a stated project convention/preference as committed, discoverable documentation. Use when the user says things like "keep track of this preference", "remember this for the project", "document this convention", or otherwise asks to persist a decision so every future session (not just this one) follows it.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

Persist the preference under discussion (or the one passed as an argument) as
committed repo documentation — not personal memory. This is for team-visible,
git-tracked conventions; it is a different mechanism from the assistant's
private cross-session memory, which never touches files in this repo.

## Core rule: CLAUDE.md is an index, not content

CLAUDE.md files must stay short — descriptions, lists, and links only. Never
write the full explanation, rationale, or examples directly into a CLAUDE.md
file. Every CLAUDE.md entry for a preference is one line:

```
- <short description>. See [`docs/<topic>.md`](../docs/<topic>.md).
```

(Adjust the relative path to the target CLAUDE.md's location.) The detail
lives in a doc under `docs/`, which is where the actual content, examples,
and reasoning go. This keeps every session's context lean — an index line
costs a few tokens; the full doc is only read when actually relevant.

## Steps

1. **Identify the preference.** Pull it from the conversation just had, or
   from the skill argument if one was given. Restate it as a clear rule, with
   the _why_ if the user gave one — the why is what lets future sessions
   judge edge cases instead of blindly following the letter of the rule.

2. **Pick the scope — which CLAUDE.md gets the index line.** This repo has
   scoped CLAUDE.md files: root `CLAUDE.md`, `.github/CLAUDE.md`,
   `scripts/CLAUDE.md`, and per-package ones (`apps/blog/CLAUDE.md`,
   `apps/diagram-maker/CLAUDE.md`, `packages/fui-components/CLAUDE.md`,
   `packages/fui-icons/CLAUDE.md`, etc — run
   `find . -maxdepth 3 -iname CLAUDE.md -not -path '*/node_modules/*'` to get
   the current list). Use the most specific one whose domain the preference
   falls under (e.g. a CI/workflow convention → `.github/CLAUDE.md`; a
   script-authoring rule → `scripts/CLAUDE.md`; something specific to one
   app/package → that app's CLAUDE.md). If it spans the whole repo or
   doesn't fit an existing scoped file, use the root `CLAUDE.md`.

3. **Check for an existing doc to extend before creating a new one.** Search
   `docs/` (`ls docs/`, `grep -ril <topic> docs/`) for a file already
   covering this area. Existing docs follow topic-prefixed kebab-case names
   (`dev-guide-*`, `dev-env-*`, `test-guide-*`, etc.) — match that style if
   creating a new file, choosing whichever prefix fits (or none, if it's its
   own topic).

4. **Write the detail to the doc.** Full explanation, rationale, examples —
   whatever a future session would need to actually apply the preference
   correctly, without needing this conversation's context.

5. **Add or update the one-line index entry** in the CLAUDE.md chosen in
   step 2. If a line for this topic already exists, update it in place
   rather than adding a near-duplicate.

6. **Format-check what you touched**: `pnpm format:check -- <files>` (or
   `format:fix` if it fails) before finishing.

7. **Report back tersely**: which CLAUDE.md got the new/updated line, and
   which doc file has the detail.
