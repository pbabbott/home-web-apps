---
'@abbottland/harbor-cleanup': minor
---

Understand the new image tag shapes before they exist: `YYYYMMDD-<run:5>-<pr:5>-<sha7>` prod tags, moving `pr-<n>` tags and `latest` are no longer treated as legacy and deleted. Protect images referenced by Deployment, StatefulSet, DaemonSet, Job and CronJob templates (not just running pods), abort the run instead of deleting when the cluster can't be read, and add `CLEANUP_DRY_RUN`.
