# Exodus Backup: Facts

[← Backup design](./README.md)

Two kinds of fact, kept apart:

1. **Confirmed by you**: decisions and statements you made. Treat as fixed. Do not re-ask.
2. **Observed**: what was checked read-only in the environment on 2026-10-27/28. True when checked; re-verify before relying on a number.

The plan is in [plan.md](./plan.md). The question-and-answer history that produced this is in git (`git show b83f254f:docs/exodus/backup-design/design.md` and the `questions-*.md` files beside it`).

---

## 1. Confirmed by you

### Purpose and scope

- This is a **one-time migration and archival** of a relatively unused machine that is being retired. It is not continuous sync, not scheduled backups, not incremental, and has no retention or deletion propagation.
- **All approved inventory is backed up**, files and directories alike.
- There is **no deadline**. Source and NAS are on the same local network, and for the real run there will be a dedicated ethernet cable to both.
- The **Windows machine may go offline unexpectedly**: every step must be idempotent and resumable.
- Source files are not expected to change during the migration. **Changes mid-copy need no handling.**
- The first destination type is **NFS**. A single NFS destination is enough. The destination is treated as **raw data** for later processing.
- No restore or re-verify tooling is wanted. No ownership or permission preservation is needed.
- No notifications. No "sign-off" step when the migration is finished.

### Inventory and coverage

- `rejected` means **final: do not back up**. It is counted as accounted for and is not listed prominently.
- **Undecided (`pending`) items block** the "all accounted" claim.
- Discovery review status (skip and on-disk acknowledgements) is **display only** beside coverage; it does not affect "all accounted".
- Coverage is reported per source and per destination. A JSON export of the coverage report is wanted.
- A discovery job and a backup job **may run at the same time**; show a warning on the start confirmation.
- Existing exclusion rules and inventory decisions are reused. No backup-specific exclusion model.
- **Junk files inside approved directories are copied** (`desktop.ini`, `Thumbs.db`, lock files). "A backup is a backup": discovery and inventory decide what is good.

### Copy behaviour

- Verification: **SHA-256 of the source stream, compared with a re-read of the destination file after fsync.**
- Existing destination file with different content: **keep both**. The existing file is never touched; the new copy gets a suffixed name (`photo.exodus-1a2b3c4d.jpg`, the first 8 characters of the job id).
- **Never overwrite or delete** destination data.
- Retries: **3 attempts for file items, 5 for directory items**.
- On a pod shutdown (`SIGTERM`): **release the work item and refund the attempt.**
- Source unreachable (machine off or SMB failing): **pause with reason `source_unreachable`**, spend no attempts. Bad credentials are not a worry; they are tested when a source is created.
- Stalled transfers: kill after a no-progress timeout (120 s).
- **Sequential by default**, with an environment variable for parallelism so it can be raised later.
- Free space on the destination is not a concern.
- Per-file `smbclient` (a process per operation) is acceptable if the real run finishes in a tolerable time.

### Metadata and the destination layout

- **Keep as much metadata about the original files as possible in the database.** Modified and creation times are especially valuable because many files are old.
- Record the `Zone.Identifier` stream contents. **Do not** record owner/ACL.
- **Do not pollute the destination**: no manifests, markers or reports on the NAS. All bookkeeping lives in the database.
- The destination mirrors the source structure: `<source name>/C/Users/…` (a folder per source, the drive letter as a folder `C`, no colon).
- All machines are in `America/Chicago`.

### Destination

- The destination export is **`192.168.4.124:/volume1/Dump`**. It already contains unrelated files ("a lot of junk"), which is why the per-source layout matters.
- It is writable "just like the video worker" (taken as uid 1000; the answer said "100").

### Architecture and naming

- A **new `apps/backup-worker`**, built like `video-worker`. It takes the destination path from an **environment variable**; you will make sure the export is mounted into it.
- **One worker deployment per destination.** Destination validation is requested through the database and run by the worker (the API cannot see the mount).
- The worker holds the same `EXODUS_CREDENTIAL_KEY` as the API.
- The shared SMB code (driver, Windows path helpers, secret box, connection-target builder) goes into a new package, **`packages/source-access`** (`@abbottland/source-access`). It does **not** go into `homelab-db`. **Schema, migrations and queries live in `homelab-db`.**
- Names stay `backup_*` (tables, routes) and `backup-worker` (app).
- **Backup jobs are human-only.** No MCP tools in the initial implementation.

### Deployment

- Kubernetes manifests live in a **separate repository, `pbabbott/home-kubernetes`**, which uses **Flux**. Namespace `home-hud`; node pool does not matter; the nodes can reach the Windows machine and the NAS.
- A **GitHub issue** with suggested manifests is wanted there. **Another Claude session will implement it later.** Do not implement or explore that repository.
- **Resource limits are tight**: be conservative with CPU and memory.
- Non-production is **local**: a sample directory supplied through the destination environment variable. Production is the only remote environment. Writing is safe there because only net-new files are written.
- The M3 milestone includes the Dockerfile, `abctl` configuration, image publication and CI wiring, following `video-worker`.

### API (decided during M2)

- There is **no "start" route** for a backup job. Creating a job makes it ready, and the worker's first claim moves it from `planned` to `running`. The UI's "Start backup job" button plans, confirms, then creates.
- The API's "folder already exists" warning for a source folder comes from the destination's validation result (`rootEntries`, reported by the worker), not from the API reading the NAS.

### UI

- Minimal home-hud pages, including an **ultra-simple "Start backup job" button**, under a **new "Backup" entry in the Exodus section of the nav**.
- "Nothing special in the UI": focus on the **backend API and the database**; get the domain right before the UI gets fancy.

### First real run

- The first real item is **`C:\backup-test\Brandchelor Party.zip`** (547 MB, approved).
- Hand-pick one small file and one small directory first, check the NAS and the coverage report, then run the full approved set.

### Process

- Commit the docs. **Each milestone is its own branch and PR, started from `feat/exodus-refinement`.**
- Start the first milestone (extracting the shared SMB package, a pure refactor) as soon as the design is settled.
- A read-only probe of the real source machine is allowed (credentials are in the database).

---

## 2. Observed

### Dev database (`homelab_api`, read-only, 2026-10-27)

- One source, `alpha-centauri`, with an SMB connection (share mapping `C:\Users` to share `Users`).
- 213 inventory items, all on `C:\`, none UNC, longest path 103 characters, none containing `;` or `"`.
- Approved: **76 files and 60 directories**. Rejected: 55 files and 22 directories. **No pending items.**
- **No nested pairs** (no inventory directory contains another item).
- Size estimates exist for 152 of 213 items; 28 of 60 approved directories and 32 of 76 approved files have none. The largest approved items are about 548 MB and 547 MB, then 235, 218, 164 and 148 MB. Expected data per source: a few hundred GB normally, 1 TB at most (for other sources).
- Small items usable for a first run: `C:\Users\pabbo_000\Documents\GameMaker\Backups\ZeldaClone` (about 5 MB), `C:\Users\pabbo_000\Downloads\Photos (2)` (about 5 MB), and files such as `Downloads\BugFixesMerge.docx` (14 KB).
- Latest migration is `0015_on_disk_reviews`.

### The existing NAS mount (`kubectl`, `video-worker`, namespace `home-hud`, read-only)

- NFS v4.2 from `192.168.4.124:/volume1/Media`, `rw`, `sec=sys`, `rsize=wsize=1 MiB`, `namlen=255`, **`hard`**. About 23 TB total, 18 TB free.
- The pod runs as uid/gid 1000; the directory is mode `777`, owned by uid 999.
- `video-worker` has requests of 100m CPU and 256Mi memory, a 1Gi memory limit, `RollingUpdate` and the default 30 s grace period.
- `hard` means an NAS outage **blocks file calls instead of failing them**.
- The Dump export is a different export from Media, so it needs its own PV and PVC.

### The source over SMB (read-only `smbclient` probe, 2026-10-28)

- `allinfo` prints `create_time`, `access_time`, `write_time`, `change_time` as `... UTC`; with `TZ=America/Chicago` the same instants print as CST/CDT. **SMB times are absolute instants**; the source's zone is irrelevant. The existing discovery `DirEntry.modifiedAt` values are UTC wall-clock because the API passes no `TZ` to `smbclient`.
- A single `smbclient` call costs about 50–200 ms. Twenty `allinfo` commands in one session took 498 ms (about 25 ms each). A recursive `ls` of an 800-line tree took 1.1 s. Large-file throughput is unmeasured.
- `ls` gives names, attribute flags, size and write time (to the second). Creation, access and change times, the stream list and the 8.3 name need `allinfo`.
- `allinfo` output includes `attributes: A (20)` and one `stream: [:Zone.Identifier:$DATA], 26 bytes` line per stream.
- `Zone.Identifier` content is read with `get "path:Zone.Identifier" local`; it contained `[ZoneTransfer]` and `ZoneId=3`.
- **Reading a file changes its access time on the source.** The probed file's access time moved from 2021-03-14 23:24:12 UTC to the time of the probe between two `allinfo` calls. The probe touched the access times of a few paths (including `Downloads\BugFixesMerge.docx`).

### Existing code (what a new session will meet)

- `apps/homelab-api/src/lib/connections/{types,smb,index}.ts`: the `ConnectionDriver` interface (`test`, `stat`, `open`, `readTail`, `list`) and the `smbclient` driver. The password is passed in the child's `PASSWD` variable; the child gets only `PATH`, `HOME` and `PASSWD`. Paths containing `;`, `"` or line breaks are refused (`assertSafeForCommand`). `types.ts` and `index.ts` import `SourceConnectionSettings` and `SourceConnectionType` from `@abbottland/homelab-db` (type-only).
- `apps/homelab-api/src/lib/{windows-path,secret-box}.ts`: path normalization and AES-256-GCM encryption with `EXODUS_CREDENTIAL_KEY`.
- `apps/homelab-api/src/services/discovery/source-connections.ts` (`loadTarget`, around lines 117–155): builds a `ConnectionTarget` from the connection row and the linked host.
- `packages/homelab-db`: schema in `src/schema/discovery.ts`, queries in `src/queries/` (claims and leases in `discovery/claims.ts` and `queue-helpers.ts`), audit in `queries/audit.ts`, `ERD.md` that must be updated with every schema change. Its dependencies are `drizzle-orm`, `drizzle-zod`, `pg`, `zod`.
- `apps/video-worker`: the template for the new worker (`config.ts`, `db.ts`, `server.ts`, `process.ts`, `worker/poll-loop.ts`, `lib/safe-path.ts`; migrations at startup under an advisory lock).
- Existing discovery behaviour to mirror, documented in `docs/exodus/processing.md` and `docs/exodus/decisions.md`: claim = lock job row (`FOR NO KEY UPDATE`) then item (`FOR UPDATE SKIP LOCKED`); lease 5 min; lazy expiry that spends an attempt; `release` refunds; exponential backoff from 30 s capped at 1 h; human retry grants exactly one more attempt; idempotent `complete`; claim with nothing to give answers `200 {item:null, reason, retryAt}`.
- Repo rules: `packages/homelab-db/CLAUDE.md` (keep `ERD.md` current), `apps/homelab-api/CLAUDE.md` (keep `README.md` and OpenAPI current), `CLAUDE.md` (never run Playwright snapshot tests locally; home-hud text uses `Typography` with no font or colour overrides).
