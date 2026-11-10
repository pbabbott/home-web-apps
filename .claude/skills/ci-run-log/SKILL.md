---
name: ci-run-log
description: Record one ci.yml run (timings, runner-node load and memory, outcome, 20-minute timeouts) as a row in the "CI run log" Google Sheet. Use after a CI run finishes, when CI fails from a timeout (before re-running it), as the last step of green-light, or when the user says "log this run", "record CI data", or "update the run log".
allowed-tools: Bash, Read, mcp__claude_ai_Google_Sheets__get_values, mcp__claude_ai_Google_Sheets__append_values, mcp__claude_ai_Google_Sheets__update_values
---

Goal: one accurate row per `ci.yml` run attempt in the run log, with as little ceremony as possible. Method and context: `docs/ci-performance.md`.

- Sheet: **CI run log**, spreadsheet ID `1eAUemR-ygBbHo0L_in0d0LHs7_35dNq0BGtZcFsX3oY`, tab `Runs` (Drive folder `My Homelab / CI Optimization`).
- Arguments (all optional): a run ID, `--attempt N`, and a short quoted description of the change under test. No run ID means the newest `ci.yml` run on the current branch.

## 1. Collect

```bash
python3 -I .claude/skills/ci-run-log/collect.py [RUN_ID] [--attempt N]
```

It prints JSON: `row` (16 values, one per column A-P) and `details` (per-job seconds, failed jobs, 20-minute timeouts, mean memory pressure on the workers). It needs `gh` and, for columns K and L, network access to the gen3 Prometheus (3-day retention); if it is unreachable or has no data for the window, they stay empty. Columns K and L hold the mean `load1` and the minimum available memory (GiB) across gen3 k3s workers 1 and 2, where the runner pods are pinned. Rows logged before the gen3 move hold disk busy % and write latency in those columns (rename the sheet headers to match). Pass `--no-prom` to skip it. Never fill node numbers from memory or estimates.

## 2. Fill the three judgment columns

The script leaves these blank:

- **E, Single change under test.** From the argument if given; otherwise from the commit messages on the branch since the previous logged SHA (`git log --oneline`). If more than one change is in the run, say so rather than picking one. Empty for a plain re-run.
- **F, Expected result.** Only if it was recorded beforehand (a `planned` row, see step 3). Never invent an expectation after seeing the result; leave it empty.
- **O, Verdict / notes.** One or two sentences: what the run shows against the previous comparable row. Always mention:
  - a partial re-run: `jobs_carried_over_from_earlier_attempts` above zero means this attempt only re-ran failed jobs, so wall time and stage times cover just those jobs and are not a full-run measurement;
  - a same-commit re-run (same SHA as an earlier row): builds are skipped when `<app>:sha-<commit>` exists, so it does not measure the layer cache;
  - any 20-minute timeouts, naming the jobs;
  - a failure that is clearly not load-related (lint, a test, the `gh-pages` push race), so it is not read as a performance result.

## 3. Write the row

1. Read the sheet: `get_values` on `Runs!A1:P200`.
2. **Dedupe.** If column C already holds this `<run id> (attempt N)`, stop and tell the user; update that row only if they asked.
3. **Planned row.** If a row with Status `planned` matches the change under test (column E), overwrite that row's A-P with `update_values`, keeping its E and F text. This is how an expectation written before the run gets paired with its result.
4. Otherwise append the row to `Runs!A:P` (`append_values`, user-entered values). Leave `Status` as `done`.
5. Read the row back and check it matches (values, not just success).

If the Sheets connector is unavailable, print the row as a tab-separated line for the user to paste, and say the sheet was not updated.

## 4. Report

Two or three lines: the run link, wall time, worker load and minimum free memory (or "no Prometheus data"), outcome, and the verdict you wrote. If the run had timeouts, say so first.

## Rules

- **Log a timed-out run before it is re-run.** A re-run starts a new attempt and the failed attempt's job data becomes harder to reach. In green-light, log first, then re-run.
- One row per run and attempt. Never edit or delete other rows; this log is the history.
- Only the Sheet is written. Don't push, re-run, or edit repo files from this skill.
- The script's numbers are the source. Don't round, merge, or "correct" them. If something looks wrong (negative duration, a wall time far from the run page), say so in the notes.
- A same-run attempt still in progress is not logged: wait for it to finish.
