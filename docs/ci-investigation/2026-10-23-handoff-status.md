# Handoff: CI hardware investigation and second-node purchase (2026-10-23)

Start here after a context reset. It lists what was done, what was decided, what is still open, and where every detail lives. **Nothing was applied to any infrastructure.** All work was reading, measuring and writing docs.

## What the work was

CI (`ci.yml`, branch `chore/ci-improvements`, PR #223) takes 40–60 min. The goal: find the real bottleneck (CPU, memory, IO), decide what infra and hardware changes would make CI much faster, and choose a second Proxmox node to buy.

## Documents (all in `docs/ci-investigation/`)

| File                                             | What it holds                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-10-21-39665721971.md`                      | Original investigation, attempts table, next steps, PromQL (earlier work; one line added linking the hardware analysis)                                                                                     |
| `2026-10-22-39792454420.md` and earlier run docs | Per-run measurements: layer cache works for the first `pnpm install`, `IMAGE_TAG` invalidates later layers                                                                                                  |
| `2026-10-22-hardware-bottleneck.md`              | **Main analysis.** Evidence from 19 runs, causes, fixes you can try, hardware paths, research tasks, test commands (Windows PowerShell and Linux), thermal detail, memory use by VM, memory recommendations |
| `2026-10-22-hardware-purchase-criteria.md`       | **Goals, Must/Should criteria, scorecard, acceptance test, process and decision log**                                                                                                                       |
| `2026-10-22-second-node-buying-guide.md`         | Qualities to look for, ELDERWAND reference, candidate research, other brands, MS-A2 store details, GMKtec K12                                                                                               |
| `2026-10-22-itx-build-draft.md`                  | DIY mini-ITX build (AM5 and AM4), RAM-price analysis, priced bill of materials                                                                                                                              |
| `2026-10-23-ms-a2-option.md`                     | **Front-runner note:** MS-A2 variants, what to check before ordering, known Proxmox issues, test plan, return triggers                                                                                      |
| `2026-10-23-handoff-status.md`                   | This file                                                                                                                                                                                                   |
| `scripts/`                                       | Prometheus helper scripts and query sets (see `scripts/README.md`)                                                                                                                                          |

## Key findings (numbers are from Prometheus, 19 CI runs since 2026-10-15)

- **Disk is the ceiling.** `nvme0n1` (Crucial P3 Plus 1 TB `CT1000P3PSSD8`, QLC, DRAM-less) is 78% busy on average and 96% at p90. Host write latency 22 ms avg (p90 46); inside the workers 52 ms avg (p90 116). Queue depth 25 avg. Writes 42 MB/s avg. Worker IO pressure 0.45 avg.
- **CPU is secondary.** Workers 22% avg busy (p90 50–64%); runner container throttled 12% avg (p90 42%). **Memory and network are not limits** for CI.
- **Suspects, not proven:** online `discard` on the workers' root mount (host sees 27 MB/s of discards against 42 MB/s of writes), LVM-thin zeroing on (`pve/data`, 64 KiB chunks), no power-loss protection on the drive (about 25 flushes/s), oversubscribed runner concurrency (up to 13 pods on 12 worker vCPU).
- **Current host thermals:** CPU (`k10temp`) 86.7 °C avg during CI, p90 92.5, max 93.4; never below 72 °C in 7 days; 78 °C at 11% load; governor `performance`. See the thermal section in the analysis.
- **Memory:** workers use p90 3–6.5 GB of 15 GB, CI peak 11.6 GB (worker-2). `marauders-map` had 20 OOM kills in 30 days (peak 9.7 of 10 GB). VMs are allocated 61 GiB against 59.8 GiB visible to Linux. Details and recommendations in the analysis.
- **ELDERWAND** (self-hosted runner, Windows 11, Corsair Vengeance a7200: Ryzen 7 5800X, 16 GB, one 1 TB **Corsair MP400 (QLC, PCIe 3.0)**, 1 GbE) runs the same jobs 4–11× faster. Same core count as the current host. **Confirmed by you 2026-10-23: its runner runs inside WSL, and its drive is a QLC Corsair MP400** (Phison E12S, PCIe 3.0 x4, sustained writes down to about 120 MB/s per reviews). So the gap is **not a better drive and not bare metal**; it is most likely contention and the storage stack (one runner on one drive, no LVM-thin or online `discard`, no 13 pods sharing a disk with etcd and services). Inference, not measured. **Cheap first experiment: cap concurrency on the current host** (ARC `maxRunners`, `ci.yml` `max-parallel`) and see how close CI gets to ELDERWAND's times. Also confirmed: **2 jobs run at once** on ELDERWAND, its drive is **752 GB used / 177 GB free of 930 GB (about 81% full)**, and **the WSL disk is on that same drive**. The current host ran up to 13 pods at once (average about 9). Caution: if a drive's total throughput is roughly fixed, 9 jobs get about a ninth each and 2 jobs about half, a ratio of about 4.5×, matching the 4–11× seen; so capping concurrency may speed each job without shortening the whole run. The `fio` tests (is the P3 Plus's total throughput about the same as the MP400's?) settle it. Measure per-job and total run time when testing.

  **UPDATE: ELDERWAND WSL `fio` results are in** (analysis doc, section "ELDERWAND WSL fio results"): sequential write about 98.5 MiB/s (131 falling to about 75), durable small writes about 258 IOPS (3.9 ms per fsync), random 4k QD32 15.8k IOPS with a bad tail (p99.9 236 ms, max 4.3 s). So **ELDERWAND's raw storage is not fast.** The new leading hypotheses: far less sharing of the drive (2 jobs vs about 9), and **caching** (WSL page cache 8 GB plus Windows write-back caching, against Proxmox `cache=none`, about 0.5 GiB of host page cache, and 3 Gi pod memory limits). Next: run the same script on a worker VM and the Proxmox host; try raising pod memory limits and `cache=writeback`. These tests come before more spending.

## Decisions made

| Date       | Decision                                                                                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-22 | Budget **$2,600 total**. Standalone Proxmox node, not a cluster. The switch is below 2.5 GbE                                                                                                                                                                                                          |
| 2026-10-22 | Start with **32 GB RAM** and keep a path to much more (96 GB or more); two-DIMM boards mean an upgrade replaces the sticks                                                                                                                                                                            |
| 2026-10-22 | G1 target tightened: proposal under 15 min from hardware, under 10 min with repo changes (to be set from the critical-path sum; not measured)                                                                                                                                                         |
| 2026-10-22 | Open to a DIY mini-ITX build if it saves money                                                                                                                                                                                                                                                        |
| 2026-10-23 | Network port count no longer a criterion (USB-C adapter is acceptable; treat it as a fallback). S2 dropped, M4 relaxed to one reliable onboard NIC                                                                                                                                                    |
| 2026-10-23 | Worker-1 VM `fio` run (idle): P3 Plus beats ELDERWAND WSL about 2× on T1/T3 (32.3k IOPS, 200 MiB/s avg) but shows a clear SLC cliff (about 49 GiB fast, then about 40 MiB/s) and a 17-minute `fstrim` after deleting about 30 GB. Drive tier is a real lever after all; discard/teardown cost is real |
| 2026-10-23 | ELDERWAND WSL `fio` run: raw storage is slow (about 100 MiB/s sustained, 3.9 ms fsync). Hypothesis shifts to less sharing plus caching; compare with a worker VM and the host before buying more hardware                                                                                             |
| 2026-10-23 | ELDERWAND facts confirmed: runner in WSL, drive is a QLC Corsair MP400 1 TB. Hypothesis "better drive" dropped; "contention and stack" favoured; cap concurrency first                                                                                                                                |
| 2026-10-23 | **Front-runner: Minisforum MS-A2** from the Minisforum store (30-day money-back, 2-year warranty). Not bought                                                                                                                                                                                         |

## The MS-A2 option in brief

- Store page (read 2026-10-23): barebone **$799** (regular $999); three M.2 (slot 1 takes M.2 2280 or **U.2**, PCIe 4.0 x4; slots 2–3 take M.2 2280 or **22110**, PCIe 3.0 x4 by default, 4.0 x4 after a BIOS switch); two SO-DIMM, **96 GB** maximum; Intel X710 (2 × SFP+), Intel I226-V and Realtek RTL8125 (2.5 GbE).
- **Confirmed by you 2026-10-23: 96 GB + 2 TB is $2,159.00 and out of stock.** Use the store's notify-me, or buy the barebone (showed in stock; confirm) and add RAM and drives. Still to confirm: that the 30-day return covers pre-configured variants.
- Rough totals: barebone + 32 GB + one 2 TB about $1,553–1,713; with two 2 TB drives about $1,907–2,107 (32 GB DDR5 SO-DIMM priced at an **assumed** $400–560, from desktop DDR5 prices; 2 TB WD SN850X about $354).
- **Open risks (forum reports):**
  - Spontaneous reboots on kernels newer than 6.14.8-2, unresolved as of 1 Aug 2026. One reporter has three units stable on 6.17.13-2 with BIOS 1.02 plus tuning.
  - The default LVM install hung at "create LVs" for one owner; a ZFS root worked.
  - BIOS 1.03 breaks PCIe passthrough (downgrade via EFI shell works). **Do not update the BIOS.**
  - Conflicting heat and noise reports (about 50 °C and 41–43 dB in one review; about 50 dBA and still hot in two others).
- Test plan and return triggers are in `2026-10-23-ms-a2-option.md`. Decide by **day 25** of the 30-day window.

## Alternatives still in the field

MS-03 (Intel; U.2 adapter, vPro, 128 GB ceiling, few owner reports; barebone $759.99 or $949–999 depending on CPU); Geekom A9 Max (best independent cooling number: under 75 °C, about 36 dB); GMKtec K12 (barebone $409.99 in 2025 reviews, three M.2 with two at x2, Realtek NICs, thermals disputed, 7-day returns); Minisforum UM890 Pro; DIY AM5 mini-ITX (about $1,860–2,160 before cooler and tax); Costco iBUYPOWER desktop ($1,799, 32 GB DDR5, 2 TB, RTX 5060 Ti; motherboard, NIC and SSD model unknown; 90-day return). Excluded: MS-S1 Max (soldered RAM, $2,499+). A ChatGPT research prompt for further searching was drafted in the conversation (not saved in the repo).

## Market facts that shape the decision (October 2026)

DDR5 64 GB (2 × 32) is about $1,000–1,300; 32 GB (2 × 16) about $400–560; DDR4 64 GB about $410–450. 2 TB TLC NVMe about $350 (a 2023 2 TB drive cost about $100): NAND prices are up too. SO-DIMM prices were not found reliably.

## Open items, in rough order

1. **Decide the purchase** (confirm the $2,159 config and return terms; or choose another candidate).
2. **Run the `fio` baseline.** Done inside WSL on ELDERWAND and on worker-1 (2026-10-23; results in the analysis doc and `results/`). `fio` is now installed on worker-1. Still to do: the Proxmox host raw volume (idle window), a CI-shaped test, and Windows outside WSL (PowerShell commands in the analysis doc); (model, WSL, 2 concurrent jobs and 81% full are now known). Optionally run the Linux version on a worker VM and (in an idle window) the Proxmox host.
3. Cheap, reversible fixes to test on the current host (none applied): remove online `discard` from the workers' fstab; `lvchange -Z n pve/data`; cap concurrency (ARC `maxRunners` and `ci.yml` `max-parallel: 6`); raise runner CPU limits; clean and repaste the host and try the `powersave` governor; the memory changes above. Find where the workers' fstab is provisioned (not found yet).
4. **Memory plan** for the current host: `marauders-map` to about 12 GB; workers to 13 GB one at a time (drain, Longhorn healthy).
5. **Repo-side:** decouple the `--prod` install from `IMAGE_TAG` in `docker/pnpm-turbo.Dockerfile`; fix the `gh-pages` push race in `fui-components-ui-tests`; triage `integration-tests (homelab-api)`.
6. Set G1 from the critical-path sum (longest job in each stage at ELDERWAND-class speed).
7. After buying: run the acceptance test (criteria doc, section 6) and fill the decision log.

## Access and tools used

- Prometheus `https://prometheus.local.abbottland.io` (no auth). Host `chimaera` = `192.168.4.192:9100`; workers `192.168.6.25–27:9100`; controller `192.168.6.24:9100`; `marauders-map` `192.168.5.91:9100`.
- `ssh root@192.168.4.192` (Proxmox host, key auth worked). Workers: user `firebolt` (key auth worked on `192.168.6.25`). `kubectl` works from the dev container. `gh` works.
- Proxmox 8.2.4, kernel 6.8.8-4-pve. VMs: 204 controller (6 GB), 205–207 workers (15 GB each), 500 `marauders-map` (10 GB); 301–304 nonprod stopped.
- ARC runner sets: `prod-gen2-dind-runner` (min 2, max 9; runner 1 CPU/3 Gi, dind 1 CPU/3 Gi) and `prod-gen2-amd64-runner` (min 2, max 8; 1.25 CPU/4 Gi). ELDERWAND and ELDERWAND-2 carry the same labels.
- Helper scripts: `scripts/`.

## Caveats on what is recorded

- Prices are web-search snapshots with mixed dates; several are marked assumptions. Re-check live before buying.
- Specs for the Minisforum, GMKtec, Geekom and other models come from reviews and roundups (several are affiliate-style) and a store page that sometimes returned HTTP 429. Model numbers for drives were written from memory in places (flagged in the docs).
- The CPU sensor was identified as `k10temp`. The 5800H maximum junction temperature (105 °C) is from memory.

## Git state

Last pushed commit: `f488b0d` on `chore/ci-improvements` (first four new docs). Everything added since is **uncommitted**: edits to the analysis, criteria, buying guide and ITX docs, plus the MS-A2 note, this handoff and the `scripts/` folder. Commit message style used so far: `docs(ci): ...`.
