# Buying guide: second Proxmox mini PC for CI and more VMs (2026-10-22)

Goal: add a second mini PC running Proxmox, host more VMs, and extend the Kubernetes cluster (more workers, mainly for CI runners). This guide lists the qualities to look for and why, tied to what the [hardware bottleneck analysis](./2026-10-22-hardware-bottleneck.md) measured. The goals, pass/fail criteria and decision process are in [Hardware purchase: goals and criteria](./2026-10-22-hardware-purchase-criteria.md); this guide is the background and candidate research behind them. Specs and prices change, so check every claim against the vendor's current spec sheet and reviews before ordering.

## What the new node has to fix

Measured on the current host (Beelink SER, Ryzen 7 5800H, one NVMe), over 19 CI runs:

- The single QLC NVMe is the ceiling: 78% busy on average, 96% at p90, 22 ms average write latency.
- CI peaks at 387 MB/s of container writes. Average 44 MB/s.
- Up to 13 runner pods at once on 12 worker vCPU.
- The host runs at 87 °C average and has about 2 GB of RAM free.
- Network is not a limit (peak 35 MB/s on 1 GbE).

So the order of importance is **storage, then cooling and sustained CPU, then RAM, then network**.

## Qualities to look for, ranked

### 1. Storage layout (most important)

| Look for                                                | Why                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two or more M.2 NVMe slots** (three is better)        | The current box has one usable slot, so the disk can only be replaced. Separate drives let you split OS/VM disks from CI scratch (`/var/lib/docker`, emptyDirs).          |
| **PCIe 4.0 x4 on at least one slot**                    | Lets a modern drive reach full speed. CI is latency-bound, so Gen3 is acceptable, but Gen4 costs little. Check the per-slot lane count: some slots are x2 or share lanes. |
| **Room for a 22110 drive, or a PCIe slot / U.2 option** | Data-centre drives with power-loss protection are often 22110 (110 mm). A 2280-only box limits you to fewer PLP models.                                                   |
| **A SATA bay or extra slot for a bulk drive**           | Keeps cold data (images, backups) off the fast drive.                                                                                                                     |
| **Buy the drives separately** and choose them yourself  | Barebone or "no SSD" kits avoid a cheap DRAM-less QLC drive like the one now in use. Avoid DRAM-less and QLC drives for the CI scratch disk.                              |

Drive qualities (use these when you do the drive research tasks):

- **Power-loss protection (PLP)** makes flushes and `fsync` cheap. CI shows about 25 flushes/s.
- **DRAM cache** and a good controller, so mapping tables aren't fetched from NAND.
- **Sustained write speed after the SLC cache is full**, not the headline number.
- **TLC or better**, with endurance (TBW) well above the 48.5 TB the current drive has written in its life. CI writes heavily; budget a drive wear check every few months.
- 1–2 TB per drive is enough for scratch; more matters less than speed.

### 2. CPU, power and cooling

| Look for                                                                                           | Why                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **8–16 cores / 16–24 threads** (e.g. current-generation Ryzen 7/9 or Intel Core Ultra-class)       | Current workers have 4 vCPU each and hit CPU PSI of 0.4 at p90. A second node adds more cores for runners. Single-thread speed helps `turbo build` and `tsc`.             |
| **A chassis that holds boost clocks**: copper heat pipe or vapour chamber, a real fan, ventilation | The current box reads 87 °C average. Reviews that run a 15–30 min all-core load (Cinebench loop, `stress-ng`) show sustained clocks, which matter more than burst scores. |
| **Configurable power limits in BIOS** (PL1/PL2 or TDP / cTDP)                                      | Lets you trade peak speed for steady temperature.                                                                                                                         |
| **Modest idle power**                                                                              | It runs 24/7. Check idle watts in reviews. Mini PCs commonly idle at 10–25 W; a desktop-class build more.                                                                 |
| **Virtualisation support** (AMD-V / Intel VT-x and VT-d / IOMMU enabled in BIOS)                   | Needed for Proxmox. A few vendors lock options.                                                                                                                           |

CPU brand is secondary to cooling. A cooler 8-core part that holds clocks beats a 16-core part that throttles.

### 3. RAM

| Look for                                                | Why                                                                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two SO-DIMM slots, user-replaceable (not soldered)**  | Soldered RAM can't be upgraded and may be smaller than you need.                                                                                            |
| **Supports 64 GB at minimum, 96–128 GB if possible**    | The current host is fully allocated at 64 GB, which leaves nothing for the host's own page cache. Plan to **leave 8–12 GB for Proxmox itself**, unlike now. |
| **DDR5** where available                                | More bandwidth and capacity per DIMM. DDR4 is fine if price matters.                                                                                        |
| **ECC** only if you can get it without a big price jump | Rare on mini PCs. A nice-to-have, not a requirement for CI.                                                                                                 |

CI worker VMs used 3–6 GB of their 15 GB, so 12 GB per worker is enough. Size by the number of VMs plus host headroom, not by the VMs' limits.

### 4. Network

| Look for                                                                                                 | Why                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2.5 GbE with an Intel NIC (e.g. i225-V/i226-V class)**, or 10 GbE with an Intel or Mellanox controller | Proxmox and Linux support Intel NICs well. The current box has a Realtek RTL8111 (1 GbE), and Realtek 2.5 GbE has had driver problems on some kernels. |
| **Two NICs** if possible                                                                                 | One for VM and k8s traffic, one for cluster and storage traffic.                                                                                       |
| **A 2.5/10 GbE switch port available**                                                                   | A faster NIC does nothing if the switch is 1 GbE. Check the existing switch first.                                                                     |

Network is not a bottleneck today (35 MB/s peak). It matters more if you later move images or the Harbor cache over the link, or add shared storage between nodes. Don't pay a premium for 10 GbE for CI alone.

### 5. Expansion and I/O

- **A PCIe slot** (even x4 mechanical) allows a 10 GbE NIC or a second NVMe adapter later.
- **USB4 / Thunderbolt** is useful for a quick 10 GbE adapter or a fast external drive for backups.
- **Remote management.** Mini PCs rarely have IPMI. An Intel vPro/AMT option or a PiKVM/JetKVM-style device on HDMI + USB helps when the box won't boot. Decide before you buy.
- **Auto power-on after power loss** and **Wake-on-LAN** settings in BIOS, so the node returns after an outage.

### 6. Proxmox and Linux compatibility

- Check that **Proxmox VE 8.x/9.x** (kernel 6.8+ or newer) runs on this exact model. Search the Proxmox forum and Reddit for the model name plus "Proxmox".
- Prefer hardware with no known problems with the NIC, the NVMe controller and sleep states.
- Disable unneeded devices (Wi-Fi, Bluetooth) in BIOS.
- Update the BIOS before installing, and keep a record of the settings you changed.

### 7. Value and risk

- Buy a model with an **easy way to open the case and reach the slots**. Check the review for the teardown.
- Prefer a vendor with BIOS updates and a warranty you can use.
- Look at the used / refurbished business-class mini PCs (small workstation lines from the large vendors) as an alternative. They often have good cooling and Intel NICs, but usually only one or two M.2 slots, so compare slot count first.

## Cluster and quorum: decide before buying

Two Proxmox nodes joined in one cluster have a quorum problem: if one goes down, the other can lose quorum and refuse changes. Options:

| Option                                                                                                       | Notes                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Do not join the Proxmox nodes.** Run two standalone hosts, and join their VMs into one Kubernetes cluster. | Simplest. The new node's VMs become k8s workers, as the current ones do. You lose live migration and single-pane management. |
| **Two nodes plus a QDevice** (a small third vote, e.g. on a Raspberry Pi or the NAS)                         | Gives a proper cluster of two, with quorum surviving one node down. Needs a third device.                                    |
| **Three nodes**                                                                                              | Normal HA cluster. Costs another box.                                                                                        |

For CI, the first option is enough: the Kubernetes layer (ARC) already schedules runner pods across workers on either host. Proxmox clustering is a convenience, not a requirement. If you want one management view, read about Proxmox Datacenter Manager.

Other Kubernetes notes for the new node:

- Join new worker VMs with the same provisioning as `tf-prod-k8s-worker-*` (Terraform/Ansible; location not found yet, see research task 6 in the analysis doc).
- Give the new node's workers a node label or taint so you can steer heavy jobs (docker-build, UI tests) to it with `nodeSelector` on the ARC runner set.
- Keep the shared caches (`actions-cache-server`, `turborepo-remote-cache`, currently on worker-1 Longhorn volumes) on the older node or move them, so cache traffic doesn't compete with builds.

## Suggested spec (a starting point, not a product)

| Item       | Minimum                              | Preferred                                         |
| ---------- | ------------------------------------ | ------------------------------------------------- |
| CPU        | 8 cores / 16 threads, strong cooling | 12–16 cores, holds boost in a 30-min load test    |
| RAM        | 64 GB (2 × 32 GB), user-replaceable  | 96–128 GB                                         |
| Storage    | 2 × M.2 (one Gen4)                   | 3 × M.2, one 22110 or PCIe slot for a PLP drive   |
| Drives     | TLC with DRAM, 1 TB each             | PLP drive for CI scratch + TLC drive for VM disks |
| Network    | 2.5 GbE Intel                        | 2 × 2.5 GbE Intel, or 10 GbE                      |
| Cooling    | Holds clocks in review               | BIOS power limits, good airflow                   |
| Management | BIOS auto power-on                   | PiKVM / vPro                                      |

How much this speeds CI is **not measured**. See the next section for what ELDERWAND's specs imply.

## Reference: what ELDERWAND is

ELDERWAND is a Corsair VENGEANCE a7200 prebuilt, per the [Corsair product page](https://www.corsair.com/us/en/p/gaming-computers/cs-9050009-na/vengeance-a7200-gaming-pc-r7-5800x-rtx-3070-1tb-m-2-16gb-ddr4-3200-cs-9050009-na). These are the as-sold specs; the machine may have been changed since.

| Item        | ELDERWAND (as sold)                                            | Current Proxmox host (Beelink SER)             |
| ----------- | -------------------------------------------------------------- | ---------------------------------------------- |
| CPU         | Ryzen 7 5800X, 8C/16T (desktop)                                | Ryzen 7 5800H, 8C/16T (mobile)                 |
| RAM         | 16 GB (2 × 8 GB) DDR4-3200                                     | 64 GB DDR4-3200                                |
| Storage     | one 1 TB NVMe M.2, brand and model **not listed**              | one 1 TB QLC DRAM-less NVMe, shared by all VMs |
| Cooling     | 240 mm liquid cooler, ATX case                                 | mini PC chassis, 87 °C average                 |
| Network     | 1 GbE (Realtek driver)                                         | 1 GbE (Realtek)                                |
| Motherboard | MSI B550-A PRO (ATX; extra M.2 and SATA slots not on the page) | OEM mini board                                 |
| Extras      | RTX 3070, 750 W PSU (unused by CI)                             | none                                           |

What this suggests (an inference, not measured):

- **It is not more CPU.** Both machines have 8 cores / 16 threads of the same Zen 3 generation. The 5800X clocks higher and holds them under a large cooler, but that does not explain 4–11×.
- **It has less RAM, not more** (16 GB against 64 GB), so a big page cache is not the cause either.
- **The difference is most likely the storage path and the layers around it.** ELDERWAND runs jobs directly on one NVMe, with no VM disk, LVM-thin, `virtio-scsi`, online `discard`, or 12 other pods writing at once. Its drive may also be a better model than the P3 Plus. The model is unknown, so that part is not established.
- **It may also run fewer jobs at a time.** How many concurrent jobs land on it was not checked.

Consequence for buying: you do not need a many-core machine to get most of ELDERWAND's speed. An 8-core box with a good NVMe, strong cooling, and jobs that do not share a disk with many other pods could be enough. More cores help only if CPU becomes the next limit after the disk is fixed. The 16 GB of RAM also shows that RAM size is not the lever.

Cheapest test of this: cap ELDERWAND to the same concurrency as a k8s worker and run `fio` on both (see the analysis doc's research task 5). That separates "better drive" from "no virtualisation layers".

## Candidates (web research, 2026-10-22)

Gathered from web search results only. Many sources are affiliate-style roundups with conflicting specs, and **I found no confirmed current prices** for any of these. Treat every row as a lead to verify on the vendor's spec page and in recent owner reports. Nothing was tested.

| Model                                                 | Storage                                                                                                                                                            | RAM                                                                      | Network                                                                              | Fit against the criteria above                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Beelink SER10 Max** (Ryzen AI 9 HX 470)             | 2 × M.2 2280 PCIe 4.0 x4, up to 4 TB each (maker's claim). No U.2 or 22110 mentioned                                                                               | 2 × DDR5-5600 SO-DIMM; maximum disputed (64 GB vs 256 GB across sources) | One 10 GbE (Marvell AQtion), Wi-Fi 6                                                 | Meets the minimum storage, not the preferred. **NIC is the concern** (see below). Single NIC. Cooling under sustained load: not found                                                   |
| **Minisforum MS-A2** (Ryzen 9 9955HX, 16C/32T)        | 3 × M.2, all PCIe 4.0 x4 (per NAS Compares comparison). U.2 / 22110 support not confirmed                                                                          | up to 96 GB                                                              | 2 × 10 GbE SFP+ and 2 × 2.5 GbE                                                      | Best fit on storage and cores. One review measured about 50–52 °C under sustained load. No USB4. Review notes inconsistent storage write speeds. Price not found                        |
| **Minisforum MS-03** (Intel Core Ultra, Panther Lake) | 3 × M.2 (lane widths conflict: one source says two Gen5 x4 + one Gen4 x1, another says the third is x1), one slot can take a U.2 drive through an included adapter | up to 128 GB; PCWorld's unit shipped with one module (single channel)    | 2 × Intel X710 10 GbE SFP+, Realtek RTL8127 10 GbE, Intel i226-LM 2.5 GbE (vPro/AMT) | Intel NICs, out-of-band management, and a U.2 path for a power-loss-protected drive. Level1Techs measured the "x16" slot as electrically x4. One comparison lists a barebone at $759.99 |
| **Minisforum MS-01** (Core i9-13900H)                 | 3 × M.2: one Gen4 x4, one Gen3 x4, one Gen3 x2                                                                                                                     | up to 64 GB                                                              | 2 × 10 GbE SFP+, 2 × 2.5 GbE                                                         | Older. Only one slot at full Gen4 speed. A comparison article cites $550–750 barebone, possibly out of date                                                                             |
| **GMKtec K8 Plus**                                    | 2 × NVMe + OCuLink                                                                                                                                                 | not checked                                                              | dual 2.5 GbE                                                                         | Cheaper option named in roundups. Barely verified here: check before considering                                                                                                        |

### About the SER10

You asked about it, so here is what the search found. The SER10 Max has the two M.2 slots and DDR5 you would want, and a 10 GbE port. Two points against it for this use:

- **The 10 GbE controller has reported faults.** Beelink's own forum has a thread on Marvell AQtion 10G connection drops. One summary page says at least eight owners describe the port dropping out on Windows and Linux, needing a driver reload or reboot, while the system still reports a healthy link. That page says it compiled owner reports and did not test the unit. I found no Proxmox-specific reports and no confirmed fix. For a CI node, a NIC that silently dies is a real risk.
- **Only one NIC, and 10 GbE needs a 10 GbE switch.** Your hosts are on 1 GbE today and CI peaks at 35 MB/s, so you would pay for speed you do not use, and could not use the port at full speed without new switching.

I did not find a spec sheet for the non-Max SER10 Pro or base SER10, so this applies to the Max only. The price of $1,259 appears in one source and is unverified.

### How this compares to what you need

- **Storage is the main thing to buy for.** Three M.2 slots (MS-A2, MS-03) allow a separate CI scratch drive. The MS-03's U.2 adapter is the clearest route to a PLP data-centre drive, which no other candidate here confirms.
- **You may not need this many cores or 10 GbE.** ELDERWAND has 8 cores and 1 GbE and is fast (see above). The big boxes cost more for features CI does not use. A two-slot, 8-core, Intel-NIC mini PC with good cooling would meet the minimum spec if one exists at a lower price. I did not find one with confirmed specs in these results.
- **Best candidates to look at first:** MS-A2 and MS-03. SER10 Max is behind them because of the NIC reports and two slots. All three need a closer look at current price, stock and recent owner reports.

### Sources

- [Beelink SER10 Max review (versus.com)](https://versus.com/en/beelink-ser10-max)
- [Beelink SER10 MAX specs and prices (minipc.guru)](https://minipc.guru/mini-pc/beelink-ser10-max)
- [Beelink forum: Marvell AQtion 10G connection challenges](https://bbs.bee-link.com/d/11812-challenges-with-marvell-awion-10g-ethernet-connection)
- [Beelink SER10 Pro and Max (TechRadar)](https://www.techradar.com/pro/this-isnt-your-typical-mini-pc-beelink-reveals-new-ser10-pro-and-ser10-max-powerhouses-boasting-ddr5-10-gbps-ethernet-and-ryzen-gorgon-point)
- [Minisforum MS-01 vs MS-A2 (NAS Compares)](https://nascompares.com/2025/10/01/minisforum-ms-01-vs-ms-a2-which-is-better/)
- [Minisforum MS-A2 review (NAS Compares)](https://nascompares.com/2025/04/30/minisforum-ms-a2-review-the-ms-01-killer/)
- [Minisforum MS-03 review (Virtualization Howto)](https://www.virtualizationhowto.com/2026/08/minisforum-ms-03-review-the-ms-01-home-lab-upgrade-ive-been-waiting-for/)
- [Minisforum MS-03 hardware review (Level1Techs forum)](https://forum.level1techs.com/t/minisforum-ms03-ms-03-review-test-and-pcie-geometry/253948)
- [MS-03 vs MS-01 vs MS-A2 (Computing for Geeks)](https://computingforgeeks.com/minisforum-ms-03-vs-ms-01-vs-ms-a2/)
- [Best Mini PC for Proxmox 2026 (minipclab.com)](https://minipclab.com/blog/best-mini-pc-for-proxmox)

## Before you buy: checklist

- [ ] Get ELDERWAND's actual NVMe model (`Get-PhysicalDisk` in PowerShell; see [Test commands](./2026-10-22-hardware-bottleneck.md#test-commands-copy-and-paste)); the Corsair page does not list it. Look up its sustained-write and sync-write benchmarks, and compare with the P3 Plus.
- [ ] Check how many jobs run on ELDERWAND at once and whether its runner service limits concurrency.
- [ ] Run the `fio` baseline from the analysis doc on the current host, so a new node can be compared with real numbers.
- [ ] Check the switch: ports, speed (1 / 2.5 / 10 GbE), free ports.
- [ ] Decide on quorum: standalone, QDevice, or three nodes.
- [ ] Shortlist 3 models. For each: slot count and lane widths, max RAM, NIC chip, idle watts, sustained-load temperature in a review, Proxmox reports.
- [ ] Shortlist drives (see the research tasks in the analysis doc for candidates) and check endurance and PLP.
- [ ] Check power: circuit, UPS capacity and runtime with the extra load.
- [ ] Pick a location with airflow. Heat was already a concern on the current box.
- [ ] Plan the first test after install: run the same `fio` jobs, then one fresh-SHA CI run on the new workers, and compare with the targets in the analysis doc (write latency under 5 ms, IO PSI under 0.15).
