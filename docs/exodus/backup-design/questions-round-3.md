# Exodus Backup: Design Questions, Round 3

Round 1 and Round 2 are in [questions-round-1-2.md](./questions-round-1-2.md). **Round 2 there is still unanswered**; this file asks different things, so you can answer either one first. The design is [design.md](./design.md).

Round 3 covers what the first two rounds left out: the environment the worker runs in, speed and failure behaviour, what "finished" means for the retiring machine, and how you will operate it. Each question has a recommendation. Write "accept" to take it as is.

---

## A. Environment and deployment

### R3-1. How will the worker be deployed and where do its manifests live?

I don't know how your cluster deploys apps. The design assumes the worker image is built and published like `video-worker` (Harbor, via `abctl`), and that the NFS export is mounted with a Kubernetes `nfs` volume.

1. Where do the Kubernetes manifests for apps live (this repo, or another)? Does the new worker need a manifest from me, or will you write it?
2. Which namespace and node pool? Does that node have network access to both the Windows machine (SMB, port 445) and the NAS (NFS)?
3. Are there resource limits I should assume (memory/CPU)? Hashing and streaming are modest, but `smbclient` processes add up.
4. Is there a non-production NFS export (or a spare directory on the NAS) for testing before the real run?

**Answer:**

1. k8s manifests live in another repository called pbabbott/home-kubernetes. we can use gh to make an issue in that repository with suggested manifests. no need to actually implement or explore this repo. it uses flux
2. namespace is home-hud, nodepool doesn't matter. they do have network access to the target machine and to the nfs share. no issues there
3. resource limits are a little tight. be conservative on how much cpu and mem is needed
4. non-production will be local, we could use some sample directory with the environment variable. in remote the only env is prod. should be fine since we're writing files net new to a destination.

---

### R3-2. What filesystem is the NAS export on?

This decides which names and features are safe to write.

- Which filesystem sits under the export (ZFS, ext4, btrfs, something else)? Is it case-sensitive?
- Does the NAS or the export restrict file names (characters, length) or file size?
- Is root squash on? (Only matters if the worker can't create files or set mtimes; the design uses `utimes`, which needs ownership of the files.)

If you don't know, say so; the validation probe can report the answers (write a file with awkward characters, test `utimes`, test a 255-byte name) and I'll add those checks.

**Answer:**

- not totally sure what filesystem. use kubectl and check video-worker. it has an nfs share mounted. we can use that to answer this question.
- also not sure on file name restrictions
- not sure what root squash is ?

---

### R3-3. What are the network speeds and the machine's availability?

For the time estimate and the lease and heartbeat settings.

- Link speed between the Windows machine and the cluster (1 GbE? Wi-Fi?), and between the cluster and the NAS.
- Is the Windows machine reliably on for the whole run? Does it sleep, hibernate, or get rebooted by updates?
- Is there a deadline (the machine retires on a date)?

At 1 GbE a 1 TB pass is roughly 3 hours per direction at best, so the hash re-read on the NAS side may be the slower half. Slow Wi-Fi would change the plan.

**Answer:**

- network speeds are pretty good. we're on the same local network, and when it comes time to run i'll have a dedicated ethernet cable run to the source machine and destination nas
- windows machine may go offline unexpectedly. we should make runs idempotent in case of interruption.
- no deadline

---

## B. Throughput and failure behaviour

### R3-4. One file at a time, or several in parallel?

The worker claims one job item at a time. Inside an item the question is how many files move at once.

- **A. Strictly sequential: one file at a time.** Simplest, easiest to reason about and resume. **Recommended** for the first run.
- **B. A small fixed number in parallel (for example 4).** Faster for many small files, at the cost of a more complicated manifest, heartbeat and error handling.
- **C. Several worker replicas, each taking a different job item.** Already supported by `FOR UPDATE SKIP LOCKED`, but each replica needs the same mount and more load on the machine.

This interacts with the SMB speed spike (R2-6). If you want speed later, B or C can be added without changing the data model.

**Answer:**

- option a - let's stay sequential. though, give a parallelism env var so it can easily be increased in the future

---

### R3-5. What should a stalled transfer do?

The existing SMB driver has a 30 second timeout for short commands. A multi-GB file legitimately streams for many minutes, so a total timeout is wrong, but a hung connection must not hold a lease forever.

- **A. A stall timeout: if no bytes arrive for N seconds, kill the transfer and count a transient `read_failed`.** Recommended; suggest N = 120.
- **B. No stall detection**: rely on lease expiry (5 minutes without heartbeat) to recover. Simpler, but the worker itself keeps heartbeating while stuck, so the item would hang.

What stall timeout do you want?

**Answer:**
accepted. option a

---

### R3-6. Should a pod restart cost an attempt?

Today in discovery, an abandoned claim (lease expiry) spends an attempt. In Kubernetes a worker pod can be rescheduled at any time. With 3 attempts per item, three restarts during one long directory copy would mark it `failed` even though nothing was wrong with the data.

- **A. Release on graceful shutdown (SIGTERM) and refund the attempt**, but a hard crash still spends one, as in discovery. Resume from the manifest makes the next attempt cheap. **Recommended.**
- **B. Never count crashes against attempts**; only count real copy errors. Harder to bound a runaway loop.
- **C. Keep discovery's rule exactly** (every abandoned claim costs an attempt).

Also: should directory items get a higher `max_attempts` than file items (for example 5), since they run long and restart more often?

**Answer:**

accepted. option a seems graceful here. and yes, max attempts should be 5.

---

### R3-7. What if the source is unreachable (machine off or SMB login failing)?

- **A. Treat it like a destination problem: pause claims, spend no attempts, and show a `source_unreachable` reason** until a source connection test passes again. The job stays `running`. **Recommended.**
- **B. Fail items with attempts and backoff** (per item), which can fail the whole queue quickly if the machine is simply asleep.

A bad password (an auth failure) should probably not pause forever: should that stop the job with an error so you notice?

**Answer:**

accepted. source_unreachable seems correct here. bad credentials aren't much of a worry since we can test and check them upon source creation

---

### R3-8. Free-space policy

Only 152 of 213 inventory items have a size estimate, so the plan's size total is a lower bound.

- **A. Warn, but allow the job**: show the estimate, the count of items without an estimate, and free space. Pause the job at runtime if the destination drops below a floor (for example 5% or 20 GB, your choice). **Recommended.**
- **B. Block job start** when the known estimate already exceeds free space.
- **C. Do nothing at plan time**; only react to `ENOSPC`.

What floor do you want (or accept the default)?

**Answer:**

accepted. space on the destination is not a concern.

---

## C. Output and "done"

### R3-9. Do you want a human-readable report on the NAS?

The design writes per-item JSONL manifests under `.exodus/manifests/`. You said you will process the directory further.

- **A. JSONL manifests only.** **Recommended** (you said that's enough).
- **B. Also write one summary per job** (CSV or Markdown: items, counts, kept-both files, issues) under `.exodus/reports/`, so you can read the outcome without the API.
- **C. A top-level inventory CSV of every copied file** (path, size, sha256), built from the manifests when the job completes, for easy processing.

Would you ever want the SHA-256 of every file somewhere easily searchable, for example to de-duplicate later?

**Answer:**

hmm.. keep the metadata for this project in the database. further processing will occur, but i'll have access to this api and database. no need to pollute the destination. i think the destination files should basically be treated as 'raw' data

---

### R3-10. What does "migration finished" mean, and does Exodus record it?

Exodus never deletes anything from the source. When you are ready to retire the machine:

- **A. Nothing special.** You read the coverage report, see `allAccounted: true`, and decide yourself. Matches the current design. **Recommended.**
- **B. A human "sign-off" action**: you mark a source as migrated against a destination. It is audited, records a snapshot of the coverage report (counts and the manifest hashes), and warns if the source later gains approved inventory that was not backed up. Small to add (one table or an audit event), useful as a record of the retirement decision.

Also: should a coverage report be exportable (JSON or CSV download) for your records?

**Answer:**
accepted answer a. json coverage report export is a good idea.

---

### R3-11. Rejected items and their fate

77 inventory items are `rejected` (55 files, 22 directories). The design treats them as intentionally not backed up and counts them as accounted for.

- Is that the final intent for all of them, or are some "rejected for now"?
- Should the coverage report list rejected items prominently so you can do a last review before retiring the machine, or just count them?

**Answer:**

yes, rejected effectively means 'do not back up' as it was something the agent said 'maybe we should?' and i as a human gave the final answer saying 'no'

---

## D. How you will operate it

### R3-12. Operator interface for the first release

Backup jobs are human-only and the design has REST routes only, with home-hud pages "later".

- **A. REST and the Swagger docs at `/docs` are enough for the first run** (create destination, plan, start, read coverage). Pages come after. **Recommended** to keep the first slice small.
- **B. A minimal home-hud page set is part of the first release**: destinations, job detail with progress, and the coverage report. Larger scope, but easier to watch a multi-hour run.

If A: is a tiny read-only status page (job progress and counts) worth adding anyway?

**Answer:**

minimal home hud page should include a 'start backup job' button. make it ultra simple and then we'll expand. option B is preferred here.

---

### R3-13. How do you want to hear about completion or problems?

- **A. Nothing automatic.** You check the API or UI. **Recommended** for the first slice.
- **B. A notification when a job finishes, fails, or the destination or source goes unhealthy.** Tell me the channel you'd use (there is a `PushNotification` tool available to me in this tool environment, but I don't know what your repo or cluster uses).

**Answer:**

option A - accepted.

---

### R3-14. Source file permissions in the copy

You said you have no ownership needs, and I planned to preserve only the modified time.

- Is preserving **modified time** enough (recommended), or do you also want creation time recorded in the manifest (not applied to the file, only recorded)?
- Windows read-only and hidden attributes are not preserved. Any problem if hidden files like `desktop.ini` and `Thumbs.db` are copied as ordinary visible files?
- Should system junk (`desktop.ini`, `Thumbs.db`, `~$*` Office lock files, `.DS_Store`) inside an approved directory be copied or skipped? Today there is no pattern-based exclusion (`docs/exodus/operations.md` lists it as a gap), so the default would be to copy everything inside an approved directory.

**Answer:**

keep as much metadata about the original files as we can in the database. modified time and creation time are definitely valuable given how old many of these files are.

---

### R3-15. Documentation and branch

The design docs are uncommitted on `feat/exodus-refinement`.

- Should I commit the design docs on this branch, or on a separate branch and PR so the design reviews on its own?
- When implementation starts, should each milestone (M0 to M5) be its own PR? **Recommended**: M0 is a pure refactor and easiest to review and merge alone.

**Answer:**

- commit the docs. yes, it will be good for future sessions.
- new branches and prs are good, but be sure to start from here (feat/exodus-refinement).
