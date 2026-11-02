# Exodus - Running, Testing and Next Steps

[← Project Exodus](./README.md)

## Running and testing

```sh
cd apps/homelab-api
pnpm dev:deps     # Postgres on :5433
pnpm dev          # API on :4003; applies pending migrations at startup

cd apps/home-hud
pnpm dev          # UI on :4022, pages under /exodus
```

To wipe the local database and refill it from prod (migrations included), see [Refreshing the local database](../../apps/homelab-api/README.md#refreshing-the-local-database).

Unit tests run with `pnpm test:unit` in `packages/homelab-db` and `apps/homelab-api`. `apps/homelab-api` also has its first integration test project (`pnpm test:int`, needs `dev:deps`): it runs end to end against the real local Postgres, covering concurrent claims, lease expiry and reclaim, retry exhaustion, completion rules, the cancel/fail and enqueue races, the database state checks, and the host/source filters, and deletes everything it creates. `apps/home-hud` has unit tests (`pnpm test:unit`) for the inventory item and audit display helpers. CI picks the project up automatically through the `test:int` task. See [Postgres & Drizzle](./dev-guide-postgres-drizzle.md) and the [integration test guide](./test-guide-integration.md).

The backup worker (`apps/backup-worker`) runs against the same database; see [Backup: Worker](./backup.md#worker). Its `pnpm test:int` uses the Postgres that `homelab-api`'s `pnpm dev:deps` started (both map port 5433, so only one of the two compose files can be up at a time).

To run the copy engine locally, point `BACKUP_DESTINATION_PATH` at a scratch directory with `BACKUP_DESTINATION_MOUNT_CHECK=none`, register that destination (Add Destination on `/exodus/backup`); the worker claims it by itself (see the [worker README](../../apps/backup-worker/README.md)). A job created through `POST /sources/:id/backup-jobs` is then claimed and copied within a poll. The source must be reachable over SMB and its connection needs a share mapping that serves the paths in the job (the dev source maps only `C:\Users`; `C$` is denied for its account). Tests need no source: they use `FakeDriver` from `packages/source-access` and temporary directories.

### Running the backup worker

What the worker does when something goes wrong, and what to do about it (details in [Backup: Pauses and shutdown](./backup.md#pauses-and-shutdown)):

| You see                                                                              | It means                                                                                                                       | What to do                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A job `running` with `stalledReason: source_unreachable`                             | The source machine does not answer. No attempts are spent; the worker asks again with a growing wait (30 s to 5 min).          | Switch the machine on or fix SMB. The job resumes by itself (one `backup_job.resumed` event). Nothing to retry.                                                                                                    |
| A job `running` with `stalledReason: destination_unhealthy`, destination `unhealthy` | An NFS error (`EIO`, `ESTALE`, `ENOSPC`, no access to the root, a lost mount) or a stalled call. No attempts are spent.        | Fix the NAS or the mount. The worker validates the destination again by itself; `POST /backup-destinations/:id/validate` asks for it at once. The job resumes on a pass.                                           |
| `/readyz` is `503` ("destination call stalled"), `worker_seen_at` goes stale         | A call on the mount has not returned for `BACKUP_STALL_TIMEOUT_SECONDS`. The worker stopped extending the lease and reporting. | Nothing: `/healthz` fails a stall timeout later and Kubernetes restarts the pod. The lease expires and spends one attempt (`backup_job_items.lease_expired`).                                                      |
| An item `queued` with last error "released by ..."                                   | The worker was stopped (`SIGTERM`) or released the item for one of the pauses above. The attempt was refunded.                 | Nothing.                                                                                                                                                                                                           |
| An item `failed` or `blocked`                                                        | Attempts used up, or a failure retrying cannot fix.                                                                            | Read the entries' issues. `POST /backup-job-items/:id/retry` or `/backup-jobs/:id/retry-failed` grant one more attempt while the job is active; for a finished job use `rerun-unresolved`.                         |
| A `.exodus-staging` folder on the NAS                                                | A copy is in flight, or a killed attempt left one.                                                                             | Nothing: the next attempt of the item, or a cancel noticed by the worker, deletes it. Staging of an item that is never claimed again after a hard kill stays until cleaned by hand (a startup sweep is not built). |

Stopping the pod (`SIGTERM`) is safe at any time: the transfer is aborted, the item is handed back and verified files are kept. Cancel a job through the API rather than by deleting the pod. Raising `BACKUP_PARALLELISM` above 1 needs a bigger memory limit (see [Parallelism and memory](./backup.md#parallelism-and-memory)).

### First real run of the backup

1. Mount the export (`192.168.4.124:/volume1/Dump`) into the worker and set `BACKUP_DESTINATION_PATH`; the worker claims the destination that is that export. Create the destination in the API and validate until `ok`; read the probe findings (uid, `utimes`, case sensitivity).
2. Create a job selecting one small file and one small directory. Start it.
3. Check the NAS tree under `<source_dir_name>/C/…`, the entries and metadata in the database, and the coverage report (those two `covered`, the rest `never_attempted`). Kill the worker mid-copy once and confirm it resumes cleanly.
4. Run the full approved set. Review `completed_with_issues` items, fix the causes, then `rerun-unresolved`. Download the JSON coverage report.

Before the first run, the account needs a share that covers the source path (see [Backup: Source access](./backup.md#copy-engine)).

### Deploying the backup worker

The manifests live in `pbabbott/home-kubernetes` (Flux, namespace `home-hud`). What the worker needs:

- Its own PV/PVC for the destination export (`Retain`, `ReadWriteMany`, NFS v4.2 with the `hard` option; the worker copes with a stalled mount). Not `media-pvc`, and not mounted into any other pod.
- `replicas: 1` with `strategy: Recreate`: exactly one worker per destination, never two overlapping in a rollout. `runAsUser`/`runAsGroup` 1000, `terminationGracePeriodSeconds` of 60 or more (on `SIGTERM` it aborts the transfer and releases its item).
- Port 4004; readiness `GET /readyz`, liveness `GET /healthz`. A hung NAS call fails `/readyz` after the stall timeout and `/healthz` after a further stall timeout, so the pod restarts about four minutes into a hung mount.
- Small resources: requests 50m CPU and 128Mi, limit 256Mi memory. Raise the memory limit together with `BACKUP_PARALLELISM` (see [Parallelism and memory](./backup.md#parallelism-and-memory)).
- The `homelab_api` Postgres variables as `homelab-api` gets them, `BACKUP_DESTINATION_PATH=/backup`, `BACKUP_DESTINATION_MOUNT_CHECK=nfs`, and `EXODUS_CREDENTIAL_KEY` with the same value `homelab-api` uses. `BACKUP_DESTINATION_ID` only pins a destination.
- Network: TCP 445 to the Windows machine and NFS to the NAS.

Not measured yet: throughput over the dedicated cable, the real total size of the approved set, and memory on a real NFS mount.

After changing `packages/homelab-db` or `packages/source-access`, run `pnpm build` there: `homelab-api` and `backup-worker` type-check them from `src/` (`types`) but load them from `dist/` at runtime (`main`, including in Jest), so a stale build shows up as confusing "undefined" errors.

## Next steps

Not started, and not decided:

- The OpenClaw agent: how it authenticates to the API and MCP endpoint, the read-only filesystem access it uses to inspect a machine (the API grants none), and the cron cadence.
- Review UI extras: bulk approve/reject (most urgent: a Downloads folder yields many file items), search by path, and a link from an inventory item to its audit history.
- Nested-inventory item inheritance and overrides.
- Stale inventory items (source file since deleted or moved): detect from `lastSeenAt` or have the copy workflow report them.
- Pattern-based exclusion (globs such as `node_modules`); rules are exact paths today.
