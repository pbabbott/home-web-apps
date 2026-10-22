# Hardware purchase: goals and criteria (second Proxmox node)

Decision record for buying a second mini PC to run Proxmox, host more VMs and extend the Kubernetes cluster. It states what the purchase must achieve, how a candidate is judged, and how to tell afterwards whether it worked. Evidence is in the [bottleneck analysis](./2026-10-22-hardware-bottleneck.md). Background, spec advice and candidate research are in the [buying guide](./2026-10-22-second-node-buying-guide.md). A DIY mini-ITX alternative is drafted in [ITX build draft](./2026-10-22-itx-build-draft.md).

**Status:** draft, updated 2026-10-22 with your inputs (budget $2,600, standalone Proxmox, sub-2.5 GbE switch, multi-port preferred, tighter G1). Items marked **[you decide]** are still open; the value shown is a proposal. Nothing has been bought or tested.

## 1. Problem

- A full `ci.yml` run takes 40–60 min and keeps hitting 20-minute step timeouts.
- The disk is the ceiling: the host's only NVMe (Crucial P3 Plus, QLC, DRAM-less) is 78% busy on average and 96% at p90 during CI, with 22 ms average write latency on the host and 52 ms inside the workers.
- The current host (Beelink SER, one usable M.2 slot, 1 GbE, 87 °C average) cannot take a second drive, and its RAM is fully allocated.
- Repo-side caching changes are estimated to cut build time by at most about half (see the [investigation](./2026-10-21-39665721971.md)).

## 2. Goals

| #   | Goal                                                  | How it is measured                                          | Target **[you decide]**                                                                      |
| --- | ----------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| G1  | Fast CI: remove the disk as the limit for CI jobs     | Wall time of a full `ci.yml` run on a fresh SHA             | Hardware alone: under 15 min. With repo changes too: under 10 min (see note below the table) |
| G2  | No timeouts caused by infrastructure                  | Count of 20-minute step timeouts across 5 consecutive runs  | 0                                                                                            |
| G3  | CI IO stays off the disk that runs the other services | CI jobs run on the new node; old node's disk busy during CI | Old node below 30% busy while CI runs                                                        |
| G4  | Room to add VMs and Kubernetes workers                | Spare vCPU, RAM and disk after the CI workers are placed    | At least 25% of RAM and 8 GB for the host itself, free                                       |
| G5  | Stay stable unattended                                | Uptime, thermal and NIC behaviour over 30 days              | No unplanned reboots, no link drops, CPU under 85 °C under load                              |

**G1 note (2026-10-22).** You said 20 min is still too long, so the proposal is tighter. These two numbers are **proposals, not measured limits**. The real floor is the critical path of `ci.yml`: first stage, then builds, then UI tests, then integration and smoke tests (stage 3 alone took about 19 min on the slow disk in [attempt 3](./2026-10-22-39676588103-attempt-3.md)). Even a warm run with skipped builds took about 25 min in attempt 2. So the hardware can bring each job near ELDERWAND speed, but the total also depends on the repo: the `IMAGE_TAG` layer invalidation, the sequential stages, and how many jobs run at once. Task: before buying, add up the longest job in each stage from a run where jobs ran on ELDERWAND-class speed, and set G1 from that sum.

Non-goals: GPU or AI workloads, high availability or live migration, 10 GbE for its own sake, replacing the current host, and moving services off it.

## 3. Constraints and open decisions

| Item                | Value                                                                                                                                                  | Status               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Budget              | **$2,600 total** (stated 2026-10-22). Assumed to cover everything: box, RAM, drives, and any switch or KVM device. Say if drives and RAM are separate. | Decided              |
| Budget split        | not decided. Prices were not confirmed in the research, so no split is proposed yet; price the shortlist first                                         | Open                 |
| Cluster model       | **Standalone Proxmox host**; join only its VMs to the Kubernetes cluster (no Proxmox cluster, no QDevice)                                              | Decided              |
| Network             | **Switch is below 2.5 GbE** (stated). Any 2.5/10 GbE port on the new node will link at 1 GbE. Managed or unmanaged, and port count, not recorded       | Decided; check model |
| Placement and power | location, airflow, outlet or UPS capacity not recorded                                                                                                 | Check                |
| Return policy       | needed to run an acceptance test before committing                                                                                                     | Check at purchase    |

## 4. Criteria

A candidate must pass every **Must** to be considered. **Should** items are scored. **Nice** items break ties. Evidence for every pass must come from the vendor spec page or from recent reviews or owner reports, written down with a link. "Not found" is a fail for a Must until resolved.

### Must (disqualifies if missing)

| #   | Criterion                                                                                                                                               | Why (evidence)                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| M1  | **At least 2 M.2 NVMe slots**, at least one verified as PCIe 4.0 x4                                                                                     | Current box has one usable slot, so the disk can only be swapped, not split                        |
| M2  | **RAM is user-replaceable SO-DIMM or DIMM**, supports at least 64 GB                                                                                    | Current host has about 2 GB free at 64 GB total; the host needs 8–12 GB for itself                 |
| M3  | **At least 8 cores / 16 threads**                                                                                                                       | ELDERWAND has 8C/16T and is fast; the current host's workers hit CPU PSI 0.4 at p90                |
| M4  | **A network controller with a clean record on Linux and Proxmox** (Intel preferred), at least 1 GbE                                                     | The switch is 1 GbE, so speed above that is unused today. A NIC that silently fails would stall CI |
| M5  | **Reports of Proxmox VE 8.x or newer running on this exact model**                                                                                      | Avoids driver and BIOS surprises                                                                   |
| M6  | **Cooling that holds clocks**: a review or owner report with a sustained all-core load of 15 minutes or more, showing CPU under 85 °C and no throttling | Current host averages 87 °C                                                                        |
| M7  | **Virtualisation and IOMMU options available in BIOS**; **auto power-on after power loss**                                                              | Needed for Proxmox and for recovery after outages                                                  |
| M8  | **Return window long enough to run the acceptance test in section 6**                                                                                   | The speedup is not yet measured; this is the main risk                                             |

### Should (scored 0–2: not met / partly / fully)

| #   | Criterion                                                                                                   | Why                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| S1  | Three or more M.2 slots, or a route to a power-loss-protected drive (22110 slot, U.2 adapter, or PCIe slot) | PLP cuts flush latency; the drive does about 25 flushes/s in CI       |
| S2  | **Two or more network ports (preferred, per you; double weight)**                                           | Separate VM and cluster traffic, or a direct link. See the note below |
| S3  | **96 GB or more supported RAM (double weight; you want to start at 32 GB and go much higher later)**        | Headroom for more workers                                             |
| S4  | Remote management (vPro/AMT, or a KVM device fits)                                                          | Headless recovery                                                     |
| S5  | Idle power at or below 25 W (from reviews)                                                                  | Runs 24/7                                                             |
| S6  | BIOS power limits (PL1/PL2 or cTDP) adjustable                                                              | Trade peak speed for steady temperature                               |
| S7  | Vendor warranty of 2 years or more                                                                          |                                                                       |

**S2 note.** With a sub-2.5 GbE switch, a second port helps only in these cases: (a) a second 1 GbE link to the same network, which gives failover but not more speed unless the switch supports link aggregation (LACP; an unmanaged switch usually does not); (b) one port for VM traffic and one for management or a separate VLAN, if the switch is managed; (c) a direct cable between two machines, such as the new node and another host. If the switch is unmanaged, S2 buys little today. A 2.5 GbE switch would use the faster ports; its price was not researched, so it is not counted in the budget yet.

### Nice

PCIe slot for a NIC or adapter; USB4/Thunderbolt; second SATA bay; small and quiet enough for the chosen room; ECC memory.

### Do not pay for

10 GbE as a deciding factor (CI peaks at 35 MB/s and the switch is below 2.5 GbE, so those ports run at 1 GbE; they are fine to have if the rest fits), a GPU, a faster CPU than needed. The $2,600 budget is large for this job, so price is not the constraint: slot count, cooling and NIC reliability are. A box that passes all Musts and has strong cooling beats a faster one that throttles. Leave budget for drives, RAM, and possibly a switch or KVM device.

## 5. Scorecard

Filled from the web research in the buying guide. `?` means not found, which counts as a fail for a Must until resolved. Update as facts are verified.

| Criterion                            | Beelink SER10 Max                        | Minisforum MS-A2     | Minisforum MS-03                   | Minisforum MS-01   |
| ------------------------------------ | ---------------------------------------- | -------------------- | ---------------------------------- | ------------------ |
| M1 two or more M.2, one Gen4 x4      | pass (2 × Gen4 x4)                       | pass (3 × Gen4 x4)   | pass, lane widths disputed         | pass (one Gen4 x4) |
| M2 replaceable RAM, 64 GB or more    | pass, maximum disputed                   | pass (up to 96 GB)   | pass (up to 128 GB)                | pass (64 GB)       |
| M3 8 cores or more                   | likely, `?`                              | pass (16C/32T)       | `?`                                | pass (14C/20T)     |
| M4 clean NIC record                  | **fail risk**: Marvell dropouts reported | `?`                  | mostly Intel; one Realtek 10G port | `?`                |
| M5 Proxmox reports on this model     | none found                               | found (one user)     | found (Proxmox 9.2 sees all NICs)  | `?`                |
| M6 sustained cooling evidence        | not found                                | one review: 50–52 °C | `?`                                | `?`                |
| M7 BIOS options, auto power-on       | `?`                                      | `?`                  | `?`                                | `?`                |
| M8 return window                     | `?` (seller)                             | `?` (seller)         | `?` (seller)                       | `?` (seller)       |
| S1 PLP route                         | no                                       | `?`                  | U.2 adapter reported               | no                 |
| S2 two or more ports (double weight) | no (one NIC)                             | yes (4)              | yes (4)                            | yes (4)            |
| S4 remote management                 | `?`                                      | `?`                  | vPro/AMT on the i226-LM            | `?`                |
| Price (box only)                     | $1,259 (one source, unverified)          | not found            | $759.99 barebone (one source)      | $550–750 (dated)   |

Reading: nothing is cleared yet. The MS-A2 and MS-03 have the most passes, and the SER10 Max has an open M4 risk. Fill the `?` cells before deciding.

## 6. Acceptance test (run within the return window)

Pass requires **all** of these. If any fails, return the box.

1. Proxmox installs and all NICs and drives show up. BIOS settings recorded (virtualisation on, auto power-on).
2. `fio` tests T1–T4 from [Test commands](./2026-10-22-hardware-bottleneck.md#test-commands-copy-and-paste), run on the new drive, with the results table filled in alongside the old host and ELDERWAND.
3. A 30-minute all-core load (for example `stress-ng --cpu 0 --timeout 1800s`) with the temperature logged. Pass: CPU under 85 °C and no throttling.
4. Network soak: 30 minutes of `iperf3` to another host at link speed, with no drops in `dmesg` or the switch counters. Repeat once after a reboot.
5. Join one worker VM to the Kubernetes cluster, label it for CI, and run one full `ci.yml` on a fresh SHA. Pass: the targets in section 2 (G1, G2) are on track, and the new node's disk write latency is under 5 ms average and IO pressure under 0.15 (same Prometheus queries as the analysis).
6. Leave it running for a week before treating G5 as met.

## 7. Process

1. [x] Budget, cluster model and switch speed decided (see the decision log). [ ] Confirm whether $2,600 includes drives and RAM, and the switch model (managed or not, free ports). [ ] Set G1 from the critical-path sum (G1 note).
2. [ ] Resolve the `?` cells in the scorecard for the top two or three candidates (spec pages, recent owner reports, current prices, return policy).
3. [ ] Run the baseline tests on the current host and ELDERWAND (research tasks 4 and 5 in the analysis). This sets the numbers the new box must beat and shows how much of ELDERWAND's speed is the drive.
4. [ ] Check the switch, the location and the power.
5. [ ] Choose the highest scorer that passes every Must. Record the choice and the reasons here.
6. [ ] Buy the box without drives. Buy the drive(s) separately from the drive research list in the analysis.
7. [ ] Run the acceptance test. Record the results in the analysis doc and update the investigation's attempts table.

## 8. Decision log

| Date       | Decision                                                                   | Reason                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-22 | Budget $2,600 total                                                        | Stated by you. Assumed all-in                                                                                                                                                                                            |
| 2026-10-22 | Standalone Proxmox host, no cluster or QDevice                             | Stated by you. Only its VMs join Kubernetes                                                                                                                                                                              |
| 2026-10-22 | Multi-port preferred; M4 relaxed to 1 GbE                                  | Switch is below 2.5 GbE, so port count matters more than port speed                                                                                                                                                      |
| 2026-10-22 | G1 tightened to under 15 min (hardware) / under 10 min (with repo changes) | You said 20 min is still too long. Proposal, to be set from the critical-path sum                                                                                                                                        |
| 2026-10-22 | Open to a DIY mini-ITX build if it saves money                             | Drafted in the ITX build draft. RAM prices (DDR5 about $1,000+ for 64 GB; DDR4 about $410–650) favour an AM4/DDR4 build; other parts unpriced                                                                            |
| 2026-10-22 | Start with 32 GB RAM, keep a high ceiling                                  | Stated by you. S3 double-weighted. DDR5 64 GB is $1,000+ so starting at 32 GB (about $400–560) fits the budget. Two-DIMM ITX boards mean the upgrade replaces sticks. AM4 tops out at 64 GB; AM5 can reach 96 GB or more |
| 2026-10-22 | Priced the DIY AM5 build and compared with MS-03 and MS-A2                 | DIY about $1,860–2,160 (cooler, tax excluded); MS-03 about $1,870–2,270; MS-A2 about $1,910–2,070 with the same RAM and drives. Same range, so choose on criteria. Not yet decided                                       |
