# Exodus Backup: Design Questions

Questions from the backup design that need your decision. Write your answer under each **Answer:** line, then the plan gets refined from it.

Design: [design.md](./design.md) (section 14).

Each question has a recommendation. Write "accept" to take it as is.

---

## 1. Where does the copy worker run?

The copy needs access to the SMB source and the NFS mount, and runs for hours.

- **A. Separate Deployment, same `homelab-api` image** (`node dist/backup-worker.js`). Reuses the SMB driver and secret box in-process. Restarts of the API don't kill copies. **Recommended.**
- **B. Loop inside the API pod.** Simplest, but heavy I/O in the API, and every API restart interrupts a copy.
- **C. New `apps/backup-worker`**, like `video-worker`. Cleanest separation, but the SMB driver and secret box would have to be extracted into a shared package first.

Destination validation must run where the NFS mount is. Either the API pod also mounts the export (simplest), or validation becomes a DB-requested task the worker picks up.

**Answer:**

My answer is: option C

> **C. New `apps/backup-worker`**, like `video-worker`. Cleanest separation, but the SMB driver and secret box would have to be extracted into a shared package first.

---

## 2. How does the NFS export get mounted?

- **A. Kubernetes `nfs` volume (kernel mount).** Exodus only verifies `server:exportPath` against `/proc/mounts`; it does not mount anything itself. **Recommended.**
- **B. Userspace NFS client.** More complex, no real benefit here.

Also: what are the export's squash and uid/gid settings on the NAS? This decides who owns the copied files.

**Answer:**

Option A - i will be sure to mount the backup path to the backup worker. the backup worker's boilerplate should match other services and require an environment variable which says where the destination path is.

---

## 3. May OpenClaw create and start backup jobs?

Discovery keeps job creation human-only.

- **A. Agent can read status, plan, and list unresolved items. Create/start/cancel/retry stay human-only** until you trust it. **Recommended.**
- **B. Agent can also create and start jobs** from a plan.

**Answer:**
no - backup jobs are human only. no need to have this be an agent activity for the initial implementation.

---

## 4. How deep should verification go?

- **A. SHA-256 of the source stream, compared with a re-read of the destination file after fsync.** Costs one extra read per file. **Recommended.**
- **B. Size and mtime only.** Fast, but doesn't catch corruption or silent truncation.
- **C. Deep verify from a fresh mount.** Strongest (defeats the NFS client page cache), slowest. Could be an optional later pass on top of A.

**Answer:**
SHA checks seem like a great idea. Option A is it!

---

## 5. What happens when a destination file already exists with different content?

- **A. Never overwrite. Mark the item `blocked` with a `dest_conflict` issue**; a human fixes it by hand or excludes the item. **Recommended.**
- **B. Keep both**: write the new copy as `name.exodus-<jobId>.ext`. Nothing blocks, but the NAS gets duplicates.

**Answer:**
option B - keep both

---

## 6. What if a source file changes while it is being copied?

The source is expected to be static, so this should be rare.

- **A. Record `changed_during_copy`, discard the partial, retry; block the item after N attempts.** **Recommended.**
- **B. Accept the last version read.** Loses the guarantee that the copy matches one consistent state of the file.

**Answer:**
this won't happen. there's no need to account for this.

---

## 4b. How many retry attempts per item? (default 3)

Applies to transient failures (read, write, verify mismatch). Discovery uses 3.

**Answer:**

3 attempts is good.

---

## 7. Do undecided inventory items block "all accounted"?

Items still in `pending` decision (neither approved nor rejected) have not been judged.

- **A. Yes, they count as unaccounted.** `allAccounted` is only true when every inventory item is covered, intentionally rejected, or intentionally excluded. **Recommended.**
- **B. No, only approved items count.** Easier to reach `true`, but pending items would be silently left out.

**Answer:**

Yes - option A.

---

## 8. Does coverage depend on the discovery review status?

Discovery has green checks per directory (skips acknowledged, on-disk contents reviewed). Coverage today only covers **inventory items**, not the whole disk.

- **A. Display only.** Show discovery review status next to coverage; `allAccounted` stays about inventory. **Recommended.**
- **B. Make it a precondition.** `allAccounted` is only true when discovery review is also complete.

**Answer:**

Accepted. option a.

---

## 9. Scope of the first slice

The plan builds **file items only** first, with directory items (manifests, carve-outs) in phase 2.

- Is that the right order? Or are most of your approved inventory items directories, so the slice should include directories from the start?
- Roughly how many approved inventory items are there, and how many are directories vs files?
- Roughly how much data in total (GB/TB)? This affects lease length, verification cost, and NAS free-space checks.

**Answer:**

- we will backup all inventory regardless of directory or file.
- check the database for inventory items.
- data in total can very greatly depending on source. at the absolute max we would see is 1TB. normal case is only a few hundred GB

---

## 10. Anything the design misses?

Things to confirm or add:

- Do you need file ownership or permissions on the NAS to match anything specific?
- Do you want a restore or "verify later" tool, or is the on-NAS manifest enough?
- Is a single NFS destination enough, or do you expect a second (e.g. offsite) soon?
- Any source paths you know are problematic (very long paths, `;` or `"` in names, junctions, OneDrive placeholders)?

**Answer:**

- no permission needs
- on the nas is manifest enough! no issue there
- single nfs is fine. i will treat this as a raw directory for further processing.
- not sure about source paths, but i'm thinking destination path structure should match the source structure

---

# Round 2

Your round-1 answers are folded into [design.md](./design.md) (section 0 lists each decision and its effect). These are the questions that came out of that. "accept" takes my recommendation.

---

## R2-1. Shared package for the extracted source-access code

Option C (a separate `apps/backup-worker`) means the SMB driver, `secret-box`, `windows-path` and the connection-target builder must move out of `apps/homelab-api`. The move is a pure refactor (milestone M0), done first.

- **A. New package `@abbottland/source-access`** at `packages/source-access`. Pure code, no DB access; callers load rows via `homelab-db` and pass them in. **Recommended.**
- **B. Put it into `homelab-db`.** One fewer package, but `homelab-db` would start spawning `smbclient` and holding crypto code.

**Answer:**

---

## R2-2. One worker per destination, or one worker for any destination?

- **A. One Deployment per destination**, configured with `BACKUP_DESTINATION_ID` and `BACKUP_DESTINATION_PATH`. It only claims jobs for that destination. Matches "the environment variable says where the destination path is". **Recommended.**
- **B. One worker serving several destinations**, with a path per destination. More config, no use for it with a single NFS destination.

**Answer:**

---

## R2-3. How does the API validate a destination it can't see?

The API pod has no NFS mount, only the worker does.

- **A. Validate is a request the worker picks up.** `POST …/validate` returns 202 and sets `validation_requested_at`; the worker runs the checks and writes the result. The worker also validates at startup. **Recommended.**
- **B. Also mount the export into the API pod** and validate there. Simpler flow, but a second mount that must stay in sync with the worker's.

**Answer:**

---

## R2-4. Destination layout details

You want the destination to mirror the source structure and be a raw directory for later processing. The design:

```
<root_dir>/
  .exodus/                       markers, manifests (outside the copied tree)
  alpha-centauri/                one folder per source (keeps sources from colliding)
    C/Users/Me/Pictures/...      drive letter as a folder, no colon
```

Please confirm or change:

1. Keep the `<source name>/` folder level, or drop it (only safe while there is one source)?
2. Drive letter as `C/` (recommended) or `C_drive/` or something else?
3. Keep-both file names: `photo.exodus-1a2b3c4d.jpg` (stem + `.exodus-` + first 8 characters of the job id + extension). OK?
4. Is a hidden `.exodus/` folder next to the source folders acceptable, given you will process the directory further?

**Answer:**

---

## R2-5. The worker needs the source-password key

To read the SMB source, the worker must decrypt the stored password, so it needs `EXODUS_CREDENTIAL_KEY` too. That key then lives in two deployments (API and worker).

- **A. Accept it.** Same secret, same 1Password path. **Recommended** for a one-time migration on a home network.
- **B. Have the API hand the worker a short-lived decrypted credential.** More moving parts, new internal endpoint, and the worker still ends up holding the password.

**Answer:**

---

## R2-6. The SMB speed spike (risk R1)

The current SMB driver starts one `smbclient` process per operation. For directories with very many small files that could be slow. M4 starts with a time-boxed spike on enumeration and bulk transfer (recursive `ls`, one long-lived session, or tar streaming).

- Is a slow-but-simple per-file approach acceptable if the spike shows the real data finishes in a tolerable time (say, a day or less for the full run)? Or do you want the faster approach regardless of added complexity?
- For the real data, is it mostly big files (photos, videos, archives) or many small files (source trees, documents)? Your inventory estimate covers only about 2.4 GB of 213 items, so the big-vs-small mix is unknown from the database.

**Answer:**

---

## R2-7. First real run

- **A. Hand-pick one small file item and one small directory item first**, check the NAS result and the coverage report, then run the full approved set (today 76 files + 60 directories = 136 items). **Recommended.**
- **B. Run the full approved set straight away.**

**Answer:**
