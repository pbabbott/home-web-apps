---
name: green-light
description: Shepherd a just-raised PR to fully green CI, then merge it into main. Monitors GitHub Actions checks, re-runs flaky failed jobs, fixes small lint/format/test breakages, pushes, repeats. Use right after a PR is opened, or when the user says "green light", "watch CI", or "get this PR merged".
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Goal: PR checks all green, then merge into `main`. Invoking this skill is the user's authorization to merge once green.

## 1. Find the PR

- `gh pr view --json number,url,headRefName,headRefOid,state,mergeable,mergeStateStatus` for the current branch. If an argument was given, treat it as the PR number.
- No PR or state not `OPEN` -> stop and tell the user.
- Confirm the working tree is on the PR branch and clean (`git status`). Don't touch unrelated uncommitted work.

## 2. Monitor loop

Poll until every check is terminal. Prefer the Monitor tool or a background `gh pr checks <n> --watch --fail-fast=false`; otherwise sleep between polls (60-120s). Don't busy-poll.

```bash
gh pr checks <n> --json name,state,bucket,link,workflow
```

CI (`.github/workflows/ci.yml`) runs lint, format, build, docker-build, UI/unit/integration/smoke tests, security-scan, deploy-blog-preview. Everything must pass or be skipped; none may be pending, failed, or cancelled.

Re-check the head SHA each loop (`gh pr view --json headRefOid`). A push starts a new run; judge only runs for the current SHA.

## 3. Handle each failure

The self-hosted runners are flaky. **Default first move: re-run, don't edit.**

1. Get the failure: `gh run view <run-id> --log-failed` (find run id from the check `link`, or `gh run list --branch <branch> --limit 10`).
2. Classify:
   - **Infra/flaky** — runner lost connection, timeout, cancelled, image pull/registry/network error, 1Password/Harbor/kube hiccup, docker-in-docker startup failure, test that passes locally and has nothing to do with the diff. -> `gh run rerun <run-id> --failed`.
   - **Small real failure** — lint error, formatting, type error, snapshot/unit test broken by this PR's change, missing import. -> fix it (step 4).
   - **Big or unclear** — needs a feature, redesign, schema/migration change, or you don't understand it. -> stop and report to the user. Don't invent big changes.
3. Same job fails on re-run with the same error -> it's real, not flaky. Reclassify as small-real or big.
4. Cap: at most **3 re-runs per job** per SHA. After that, stop and report.

## 4. Fixing small things

- Reproduce narrowly and locally when cheap: `pnpm lint`, `pnpm format`, a single package's unit test. See `docs/dev-guide-commands.md`.
- **Never run Playwright snapshot/screenshot UI tests locally** (CLAUDE.md restriction). For UI-test failures, read the CI logs/artifacts; re-run if flaky; otherwise report.
- Keep the fix minimal and in scope of the PR. No refactors, no new features, no dependency bumps, no workflow edits to dodge a failing check, no skipping/deleting tests, no `--no-verify`.
- Commit with a conventional message (`fix:`/`style:`/`test:`/`chore:` plus scope) and the standard Co-Authored-By trailer, then `git push`. Never force-push.
- After push, return to step 2 with the new SHA.

## 5. Merge

Only when all of these hold:

- Every check on the current head SHA is `pass` (or `skipping`).
- `mergeable` is `MERGEABLE` and `mergeStateStatus` is `CLEAN` (or `HAS_HOOKS`/equivalent non-blocking). If `BEHIND`/`DIRTY` (conflicts): if behind, `git merge origin/main` into the branch, push, and loop again; if conflicts are non-trivial, stop and report.
- No required review blocking (`gh pr view --json reviewDecision` not `CHANGES_REQUESTED`).

This repo allows **merge commits only** (squash and rebase are disabled):

```bash
gh pr merge <n> --merge
```

Don't pass `--delete-branch` unless the user asked. After merging, confirm `gh pr view <n> --json state,mergedAt` shows `MERGED`. The `pr-teardown` and `docker-publish` workflows trigger from the merge/close; optionally note them but don't wait on them.

## 6. Report

Short summary: PR link, what failed, what was re-run vs fixed (with commit SHAs), final state. If stopped early, say exactly which check, why, and what the user needs to decide.

## Guardrails

- Don't merge on red, pending, or stale-SHA results. Don't use `--admin` or bypass branch protection.
- Don't mark the job done because "it's probably flaky" — a re-run must actually pass.
- Stop and ask on anything outward-facing beyond push/re-run/merge of this PR.
