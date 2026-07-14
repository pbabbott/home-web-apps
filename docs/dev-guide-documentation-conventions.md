# Dev Guide - Documentation Conventions

The purpose of this document is to explain how `CLAUDE.md` files and `docs/*.md` files relate, so project knowledge stays organized and doesn't bloat every session's context.

## CLAUDE.md is an index, not content

`CLAUDE.md` files (root and per-directory, e.g. `.github/CLAUDE.md`, `scripts/CLAUDE.md`, `apps/blog/CLAUDE.md`) are loaded into context automatically. Keeping them terse — descriptions, lists, and links only — means every session pays only a small token cost up front, and pulls in the full detail from `docs/` only when it's actually relevant to the task at hand. Writing long-form explanations directly into a CLAUDE.md means every session pays that cost every time, whether the topic is relevant or not (context rot).

Each entry in a CLAUDE.md should be a single line:

```
- <short description>. See [`docs/<topic>.md`](../docs/<topic>.md).
```

(Adjust the relative path depending on the CLAUDE.md's location in the tree.)

## Where detail goes

Full explanations, rationale, and examples belong in `docs/`. Existing files follow topic-prefixed kebab-case names — `dev-guide-*` (how to do something in this repo), `dev-env-*` (local environment setup), `test-guide-*` (per-suite testing docs) — pick whichever prefix fits, or none if the topic doesn't fit an existing family.

Before creating a new doc, check whether an existing one already covers the topic (`ls docs/`, `grep -ril <topic> docs/`) and extend it instead of splitting related content across files.

## Capturing a new preference

Use the `/project-preference` skill (`.claude/skills/project-preference/SKILL.md`) when you want a decision or convention to persist for every future session, not just the current one. It picks the right CLAUDE.md scope, writes the detail to a doc, and adds the one-line index entry — following the rules above.
