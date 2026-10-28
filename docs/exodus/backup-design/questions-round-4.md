# Exodus Backup: Design Questions, Round 4

Earlier rounds: [questions-round-1-2.md](./questions-round-1-2.md) (round 2 there is still unanswered) and [questions-round-3.md](./questions-round-3.md) (answered). The design is [design.md](./design.md), section 14 lists the open items these questions come from.

Write your answer under each **Answer:** line. "accept" takes my recommendation. Round 4 is mostly short confirmations, plus a few decisions that would be expensive to change later (naming, the metadata to record, permission to probe your source machine).

## Facts from the dev database (queried read-only)

- The largest approved items are about **548 MB** (`C:\Users\…\Downloads\Brandchelor Party`, a directory) and **547 MB** (`C:\backup-test\Brandchelor Party.zip`, a file). Next: 235 MB, 218 MB, 164 MB, 148 MB.
- Size estimates are missing for 28 of 60 approved directories and 32 of 76 approved files, so the real total is still unknown. Nothing in this source is near the 1 TB ceiling you mentioned; that was for other sources.
- `C:\backup-test\…` looks like a test fixture that was approved.

---

## R4-1. Confirm the Round 2 defaults

Round 2 was never answered, so I applied these defaults. Write "accept all" or list the numbers you want to change and how.

1. **Shared package:** `packages/source-access` (`@abbottland/source-access`), not `homelab-db`.
2. **One worker Deployment per destination**, selected by `BACKUP_DESTINATION_ID`.
3. **Validation** is requested through the DB (the API returns 202) and run by the worker.
4. **Layout:** `<root_dir>/<source name>/C/Users/…` (a folder per source, the drive letter as `C`, no colon), and keep-both names like `photo.exodus-1a2b3c4d.jpg`. The `.exodus/` folder from Round 2 no longer exists: nothing is written to the destination except copied data (plus transient staging and probe folders).
5. **The worker holds `EXODUS_CREDENTIAL_KEY`**, the same secret as the API.
6. **SMB speed:** a slow-but-simple per-file `smbclient` approach is acceptable if the spike shows the real run finishes in a tolerable time.
7. **First real run:** hand-pick one small file item and one small directory item, check the NAS and the coverage report, then run the full approved set.

**Answer:**

---

## R4-2. Which NAS export holds the backup?

The destination row needs the real `server:exportPath`, and the worker's PVC must point at the same place, because the worker checks `/proc/mounts` against it. The video worker mounts `192.168.4.124:/volume1/Media`.

- What is the export (or a sub-folder of one) for the backup, e.g. `192.168.4.124:/volume1/<something>`?
- Is it the same export as media with a sub-folder (then `root_dir` is that sub-folder and the PVC could be shared), or a separate export (a new PV and PVC)? I recommend a **separate export or at least a separate PVC**, so the destination's mount identity can't be confused with the media library.
- Is the folder writable by uid 1000, as the video worker's is?

**Answer:**

---

## R4-3. What time zone is the Windows machine in?

SMB reports file times as local time without a zone. To apply the right modified time to the NAS file, and to store a correct instant, I need to know which zone to interpret them in.

- **A. You tell me the zone (e.g. `America/Chicago`), and it becomes a setting on the source's connection.** Times are stored as real instants. **Recommended.**
- **B. Store the times exactly as reported (no zone), and apply them as if they were in the worker's zone.** Simple, but the NAS file times could be off by the zone difference.

If a daylight-saving boundary matters to you (old files near the changeover), tell me; the spike will check what `allinfo` actually prints.

**Answer:**

---

## R4-4. Junk files inside approved directories

You didn't answer this in Round 3, so the default is to copy everything inside an approved directory, including `desktop.ini`, `Thumbs.db`, `~$*` Office lock files and `.DS_Store`.

- **A. Copy everything.** Matches "raw data". Recommended: it is the simplest, and nothing is silently dropped.
- **B. Skip a short built-in list** (`desktop.ini`, `Thumbs.db`, `~$*`, `.DS_Store`) and record each skipped file as an entry, so it is accounted for. This needs a small amount of pattern logic that does not exist today.

**Answer:**

---

## R4-5. How much source metadata do you want recorded?

The design records, per file and directory: size, creation, modified, accessed and changed times, Windows attributes, alternate-stream names and sizes, and the SHA-256. Two things it does not yet record:

1. **Owner and permissions** (the security descriptor as text, e.g. owner and ACL entries). Another call per file over SMB. Useful if you ever want to know who owned something; of little use for a personal machine.
2. **Contents of the `Zone.Identifier` stream** (Mark-of-the-Web: the download URL and referrer). It is tiny and tells you where a file came from. The discovery playbook already uses it as a signal. Recorded as text on the entry.

Pick any: owner/ACL, Zone.Identifier contents, neither. I recommend **Zone.Identifier contents yes, owner/ACL no**.

**Answer:**

---

## R4-6. May I probe the real source machine during the spike?

The M4 spike (design risk R1/R6) needs to run `smbclient` against `alpha-centauri` to measure enumeration speed, see what `allinfo` prints (creation time, time zone), and time a transfer. Everything would be **read-only**:

- `ls` and `allinfo` on a handful of paths inside approved inventory.
- Fetching **one or two small approved files** to my scratch directory (not to the repo, not to the NAS), then deleting them.
- No writes, deletes or renames on the source, and no access outside approved inventory paths.

Is that OK? If so, any paths I should avoid or prefer, and is the machine available during working hours?

**Answer:**

---

## R4-7. Discovery and backup at the same time

Discovery allows one active job per source. A backup job reads the same machine over SMB.

- **A. Allow them to run at the same time**; the backup's scope is frozen at creation, so it is unaffected. A warning shows on the start confirmation if a discovery job is active. **Recommended.**
- **B. Refuse to start a backup job while a discovery job is active for the source** (and the reverse), to avoid loading a retiring machine twice.

**Answer:**

---

## R4-8. Naming: `backup_*` or something else?

The design names tables `backup_destinations`, `backup_jobs`, `backup_job_items`, `backup_entries`, routes `/backup-*`, and the app `backup-worker`. Earlier, `backup_sources` was renamed to `sources` (migration `0008`), and renames are painful. "Backup" is also the word you used for the whole workflow.

- **A. Keep `backup_*`.** **Recommended.**
- **B. Use `copy_*`** (`copy_jobs`, `copy_job_items`, `copy_entries`, `copy-worker`). Avoids implying a full backup system, which this is not.
- **C. Another name** (for example `migration_*`, `transfer_*`).

**Answer:**

---

## R4-9. Build, publish and CI wiring for the new app

A new app normally needs a Dockerfile, `abctl.yml`, image publication to Harbor, and CI workflow entries (see `docs/dev-guide-publication.md` and `.github/CLAUDE.md`).

- **A. M3 includes all of it**, copied from `video-worker`'s pattern, so the image builds on PRs and publishes on merge. **Recommended.**
- **B. M3 only adds the app and local dev**; CI and publication become a separate milestone.

**Answer:**

---

## R4-10. The `home-kubernetes` issue

The draft is Appendix B of [design.md](./design.md).

1. Should I create the issue **now** (so manifests can be prepared while code is written), or at the start of M3 once the image exists? I recommend **at the start of M3**, so it can name a real image and the final environment variables.
2. Anything to add or change in the draft: Flux conventions I should follow (for example how secrets are referenced), a different `securityContext`, `strategy`, resource numbers?
3. Should the issue be written for you to implement, or for another Claude session to implement in that repository?

**Answer:**

---

## R4-11. home-hud placement

- Where in the Exodus nav should the pages go (a new "Backup" item next to jobs and inventory is my default, at `/exodus/backup`)?
- Besides the Start button, job progress and the coverage page, is there anything you must see on the first release (for example the list of kept-both files, or per-item errors on the job page)? The design's job page already shows each item's status and last error.

**Answer:**

---

## R4-12. Where does the approved `C:\backup-test\…` data stand?

`C:\backup-test\Brandchelor Party.zip` (547 MB) is approved. It is also a good candidate for the **first real run** (a single real file, big enough to exercise heartbeats and hashing). Is it test data you are happy to copy, or should it be rejected or excluded before the first run?

**Answer:**

---

## R4-13. When should implementation start?

- **A. Start M0 (the pure refactor extracting `source-access`) as soon as this round is answered.** **Recommended**: it is independent of every open question above.
- **B. Hold implementation until you have reviewed the whole design**, then start.

If A, should I create the M0 branch from `feat/exodus-refinement` and open the PR myself, or stop after the branch and let you open it?

**Answer:**
