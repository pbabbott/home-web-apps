# CI Performance

The CI investigation, status and run history live in Google Drive, not in this repo: `My Drive / My Homelab / CI Optimization`.

- [CI run log](https://docs.google.com/spreadsheets/d/1eAUemR-ygBbHo0L_in0d0LHs7_35dNq0BGtZcFsX3oY/edit): one row per `ci.yml` run, written by the `ci-run-log` skill (`.claude/skills/ci-run-log`).
- [CI performance: status and next steps](https://docs.google.com/document/d/1xD06xI8mo2FSSan9EZYHncRfrild4NLgFZttzBL3AjY/edit): where the time goes, what has been tried, what is next.
- [CI slowness investigation](https://docs.google.com/document/d/1mFf7AxrkV40yzf2uz8zb0tE8pxRcK2H0kt4ejBjiZdU/edit) and [CI disk bottleneck analysis](https://docs.google.com/document/d/1rrGCGgVrC3K8qBs3Be0VUsyh5Roa4VhMbTF34C-Oafw/edit): the evidence behind the status doc.
- `hogwarts research` (subfolder): hardware purchase research.

## Experiment rules

The `ci-run-log` and `green-light` skills assume these:

- Change one thing per run, and write the expected result in the run log before the run.
- Use a fresh SHA for every comparison: builds are skipped when `<app>:sha-<commit>` already exists, so a same-SHA re-run does not measure the layer cache.
- Log a run that hit a 20-minute timeout before re-running it; a re-run starts a new attempt and the failed attempt's job data gets harder to reach.
- Compare in a quiet window, and avoid repeated pushes to an open PR: every push runs the full pipeline on shared infra.
