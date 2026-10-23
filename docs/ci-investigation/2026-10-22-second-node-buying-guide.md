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

CI worker VMs used 3–6.5 GB at p90 and peaked at 11.6 GB of their 15 GB (see the memory section of the bottleneck analysis), so about 12 GB per worker covers the peak. Size by the number of VMs plus host headroom, not by the VMs' limits.

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

| Item        | ELDERWAND (as sold)                                                      | Current Proxmox host (Beelink SER)             |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| CPU         | Ryzen 7 5800X, 8C/16T (desktop)                                          | Ryzen 7 5800H, 8C/16T (mobile)                 |
| RAM         | 16 GB (2 × 8 GB) DDR4-3200                                               | 64 GB DDR4-3200                                |
| Storage     | one 1 TB Corsair MP400 (QLC, Phison E12S, PCIe 3.0 x4), confirmed by you | one 1 TB QLC DRAM-less NVMe, shared by all VMs |
| Cooling     | 240 mm liquid cooler, ATX case                                           | mini PC chassis, 87 °C average                 |
| Network     | 1 GbE (Realtek driver)                                                   | 1 GbE (Realtek)                                |
| Motherboard | MSI B550-A PRO (ATX; extra M.2 and SATA slots not on the page)           | OEM mini board                                 |
| Extras      | RTX 3070, 750 W PSU (unused by CI)                                       | none                                           |

What this suggests (an inference, not measured):

- **It is not more CPU.** Both machines have 8 cores / 16 threads of the same Zen 3 generation. The 5800X clocks higher and holds them under a large cooler, but that does not explain 4–11×.
- **It has less RAM, not more** (16 GB against 64 GB), so a big page cache is not the cause either.
- **It is not a better drive.** You confirmed the drive is a **Corsair MP400 1 TB**: PCIe 3.0 x4, Phison E12S controller, Micron 96-layer **QLC** NAND, with a dynamic SLC cache of about a quarter of capacity and a worst-case sustained write of about 120 MB/s ([Tom's Hardware](https://www.tomshardware.com/reviews/corsair-force-mp400-ssd-review), [AnandTech](https://www.anandtech.com/show/16310)). That is the same class as your P3 Plus (QLC), and older and slower on paper. I did not confirm whether it has a DRAM cache.
- **The runner is inside WSL**, so jobs there also go through a virtual disk file (`ext4.vhdx` on NTFS). That is an extra layer, yet it is still 4–11× faster.
- **So the likely difference is contention and the storage stack, not drive quality.** ELDERWAND has one drive that serves one runner (plus whatever else runs on a desktop), with no LVM-thin, no online `discard`, no 3 VMs and up to 13 pods writing at once to the same disk, and no etcd, Longhorn or service traffic on it. This is an inference, not measured.
- **It may also run fewer jobs at a time.** How many concurrent jobs land on it was not checked.

**ELDERWAND facts (confirmed by you 2026-10-23):** 2 jobs run at once (the two registered runners); the drive has 752 GB used, 177 GB free of 930 GB (about 81% full); the WSL disk is on that same drive. So a nearly full QLC drive, with a virtual disk on top, serves only 2 jobs at once and is still 4–11× faster per job than the current host. The current host ran up to 13 runner pods at once (average about 9) on 3 workers sharing one drive. (A full QLC drive normally has a smaller fast-write cache; this is from general knowledge, not measured.)

**Caution on the conclusion:** if one drive's total throughput is roughly fixed, nine jobs get about a ninth each and two jobs about half each, a ratio of about 4.5×, which matches the 4–11× seen. That would mean **capping concurrency makes each job faster but may not shorten the whole run**, unless the drive loses total throughput when overloaded (the 52 ms guest latency and 100% busy suggest it might). The `fio` tests settle this: if the P3 Plus delivers about the same total throughput as the MP400, the real lever is more total disk capacity (a second drive or node), not only a lower job count. Measure both: per-job time and total run time.

Consequence for buying: you do not need a many-core machine, or even a premium drive, to get most of ELDERWAND's speed. What matters is a drive that is not saturated: isolation (one job set per disk, few concurrent jobs, a simple storage stack) and cooling. A better drive (TLC with DRAM, or power-loss-protected) adds margin, but this evidence suggests that **limiting concurrency on the current host is the cheapest first experiment**, because a QLC drive was fast when it was not contended. More cores help only if CPU becomes the next limit after the disk is fixed. The 16 GB of RAM also shows that RAM size is not the lever.

Cheapest tests: (1) cap concurrency on the current host (ARC `maxRunners` and `max-parallel`) and see how close CI gets to ELDERWAND's job times; (2) run the `fio` tests on ELDERWAND from inside WSL and on Windows (see the analysis doc, research task 5) and on a worker VM, to see how the MP400 behaves under the same test as the P3 Plus.

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

## Other brands checked (2026-10-23)

You are leaning toward the MS-03 or MS-A2, so this checks whether another brand beats them. Web search only; guides conflict and several are affiliate roundups. **Coverage gaps:** Geekom, Framework Desktop and HP Z2 Mini returned nothing usable, and new Lenovo/HP/Dell small-form-factor models returned little.

| Brand / model                                                       | What the results say                                                                                                                                | Against the criteria                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Minisforum MS-01                                                    | Most-recommended Proxmox box in the 2026 guides: dual X710 10 GbE SFP+, two 2.5 GbE, three M.2, PCIe slot. RAM ceiling 64 or 96 GB (sources differ) | Older, only one slot at full Gen4 speed, 13th-gen CPU                           |
| Beelink SER9 Max / SER10 Max                                        | One 10 GbE port (Marvell on the SER10 Max, with the dropout reports above), two M.2                                                                 | Single NIC, two slots                                                           |
| Beelink EQ14 / SER8                                                 | Budget and value picks; the EQ14 (N150) measured about 10 W with three VMs                                                                          | Too small for CI (low core count, few slots)                                    |
| GMKtec K11 / K8 Plus                                                | OCuLink port for expansion, two M.2. Sources conflict on the K11's network: dual 2.5 GbE in one guide, one 10 GbE (Aquantia AQC113) in another      | Two slots only                                                                  |
| Aoostar WTR Max                                                     | Dual SFP+ (Intel X710) and five storage slots                                                                                                       | NAS-oriented and bulky; not a compact CI node                                   |
| ASUS NUC 15 Pro+ (Intel exited the NUC business; ASUS now sells it) | One 2.5 GbE port; reviewers criticise the cooling                                                                                                   | Single NIC, cooling concern                                                     |
| Used Lenovo ThinkCentre Tiny, HP Mini, Dell Micro                   | Recommended for value, one guide says a used ThinkCentre still beats most new boxes on value                                                        | Typically one or two drive slots and 1 GbE: cannot fix the disk limit by itself |

**Result:** none of the other brands matches the MS-03 or MS-A2 on slots plus ports. The Minisforum models are the only ones found with three M.2 slots, several network ports and a high RAM ceiling. That also means the choice is between two models from the same brand, so check the model-specific reports below rather than brand reputation.

### MS-A2 owner reports (secondary sources unless noted)

- **BIOS 1.03** (April 2026) reportedly broke VM startup with PCIe passthrough ("1:1 IOMMU mapping" error); the workaround was downgrading to 1.02, and some owners reportedly bricked units doing it. CI does not need passthrough, but this shows BIOS updates are a risk. Seen through a comparison article, not the forum thread.
- **Spontaneous reboots** on kernel 6.17 and 6.14 in a [Proxmox forum thread](https://forum.proxmox.com/threads/spontaneous-reboots-on-minisforum-ms-a2-with-6-17-and-later-6-14.181084/). One poster has three units on 6.17.13-2 with BIOS 1.02 and no issues, so it may depend on version. A reboot would hit goal G5 (stability), so read the thread first.
- **Noise and heat:** about 50 dBA under load in ServeTheHome testing, louder than the MS-01. William Lam found it still ran too hot after firmware 1.0.2 added fan control. This conflicts with the earlier review that measured 50–52 °C and 41–43 dB, so the cooling criterion (M6) is **not resolved** for the MS-A2.
- **Single anecdotes:** one owner returned a unit for about 75 W idle (about 200 W full load); one unit died with no video output. These could be isolated.
- No ECC (needs a Ryzen PRO chip) and no SR-IOV on the iGPU; neither matters for CI.

### MS-03

Newer (reviews from August 2026), so it has fewer owner reports. The Realtek 10 GbE port has the least track record, and its PCIe slot is x4. Read the [Level1Techs review](https://forum.level1techs.com/t/minisforum-ms03-ms-03-review-test-and-pcie-geometry/253948) and look for stability and thermal reports before buying.

### Sources

- [Best Mini PC for Proxmox and Homelab (2026), Computing for Geeks](https://computingforgeeks.com/best-mini-pc-for-homelab-proxmox/)
- [Best Mini PCs for Proxmox in 2026: Beelink vs Minisforum vs ASUS, HomeNode](https://homenode.tech/best-mini-pcs-proxmox-2026/)
- [Best Mini PC with 10GbE for a Home Lab in 2026](https://homelabpicks.com/mini-pc/best-mini-pc-10gbe/)
- [Minisforum MS-01 wins the 10GbE mini PC race in 2026 (Botmonster)](https://botmonster.com/hardware/best-mini-pcs-10gbe-networking-homelab-2026/)
- [Improving thermals on Minisforum MS-A2 (William Lam)](https://williamlam.com/2025/09/quick-tip-improving-thermals-on-minisforum-ms-a2.html)
- [MS-A2 won't post (Level1Techs)](https://forum.level1techs.com/t/minisforum-ms-a2-wont-post/246321)
- [Asus NUC 15 Pro review (Notebookcheck)](https://www.notebookcheck.net/The-new-NUC-generation-Asus-NUC-15-Pro-shows-strong-performance-in-the-review-and-supports-external-GPUs.1184128.0.html)

## Broader field once ports stop mattering (2026-10-23)

You said port count should not limit the search, since a USB-C adapter can add one. That reopens boxes with a single NIC. Search-only findings; sources are mostly roundups, so verify.

| Model                                    | Storage / RAM                                                   | Cooling / noise evidence                                                                    | Notes                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Minisforum UM890 Pro (Ryzen 9 8945HS)    | two M.2 PCIe 4.0, up to 96 GB DDR5                              | roundup says dedicated SSD and RAM cooling and near-silent (second-hand claim)              | Fits the slot and RAM-ceiling criteria on paper. Price not found                                                                   |
| Geekom A9 Max (Ryzen AI 9 HX 370)        | base 32 GB in one listing; slot count and ceiling not confirmed | reviewer: CPU under 75 °C at sustained 100% load, about 36 dB (best cooling evidence found) | Premium priced. Not a Ryzen 9 desktop-class chip                                                                                   |
| Beelink SER9 Pro                         | RAM ceiling and slot count not confirmed                        | maker claims 32 dB; no independent test found                                               | Unverified                                                                                                                         |
| GMKtec K11 (Ryzen 9 8945HS)              | two M.2 plus OCuLink                                            | no cooling or noise tests found                                                             | Least verified                                                                                                                     |
| Beelink SER10 Max                        | two M.2 PCIe 4.0 x4, DDR5 (ceiling disputed)                    | not found                                                                                   | Its Marvell 10 GbE port has dropout reports. With a USB adapter instead, that matters less. Price $1,259 in one source, unverified |
| Minisforum MS-S1 Max (Ryzen AI Max+ 395) | **128 GB soldered LPDDR5x**                                     | up to 48 dB under load                                                                      | **Excluded:** RAM not replaceable (fails M2) and $2,499–2,959                                                                      |
| MS-03, MS-A2, DIY AM5, Costco iBUYPOWER  | see earlier sections                                            |                                                                                             | Still in the field; the MS-03 and MS-A2 lose their port advantage but keep three M.2 slots and a higher RAM ceiling                |

What changes now: the MS-03 and MS-A2 are no longer ahead on ports. They are still ahead on **three M.2 slots, RAM ceiling (96–128 GB) and, for the MS-03, a U.2 route to a power-loss-protected drive**. Boxes with two M.2 slots meet the minimum (one boot/VM drive, one CI scratch drive) but have no PLP route. If cooling evidence matters most, the Geekom A9 Max has the best independent number found, and the DIY or Costco desktop has the most cooling headroom.

### GMKtec K12 (Ryzen 7 H 255), checked 2026-10-23

The GMKtec store page returned HTTP 429 (rate limit) both times, so this comes from reviews: [Wccftech](https://wccftech.com/review/gmktec-k12-amd-ryzen-7-h-255-mini-pc-review-strong-specs-io-for-just-409-us/), [Hostbor](https://hostbor.com/gmktec-k12-minipc-review/) and the other reviews found in search. **Confirm every figure on the live product page.**

| Item          | Reported                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CPU           | Ryzen 7 H 255, 8C/16T Zen 4, 45 W default (35–54 W adjustable), boost 4.9 GHz, Radeon 780M. A China-market "Ryzen 200" part with no NPU |
| RAM           | Two DDR5-5600 SO-DIMM. **Maximum conflicts: 128 GB (Wccftech), 96 GB (Hostbor), 64 GB (another review)**                                |
| Storage       | Three M.2 2280: one PCIe 4.0 x4 and two PCIe 4.0 x2 (about 4 GB/s each)                                                                 |
| Network       | Dual 2.5 GbE, **Realtek RTL8125BG** (not Intel). Wi-Fi 6E                                                                               |
| Expansion     | USB4, and OCuLink (PCIe 4.0 x4), meant for an external GPU                                                                              |
| Power         | About 11–12 W idle, about 65–88 W under load, 120 W adapter                                                                             |
| Price         | $409.99 barebone and $609.99 with 32 GB and 1 TB in the reviews (2025). One 2026 review says about $690 is typical now. Verify          |
| Support       | 1-year warranty and **7-day returns** (Hostbor)                                                                                         |
| Linux/Proxmox | Ubuntu installed with no custom drivers; one review says Proxmox "works well" but nobody tested it                                      |

**Thermals conflict:** Wccftech says the CPU stayed below 70 °C in its tests (65 W profile, vapor chamber, two fans), while Hostbor measured it peaking at 94–95 °C with 40 dBA (default) to 46 dBA (performance mode) of fan noise. Cooling is the weak point of your current host (87 °C average), so this is unresolved for criterion M6.

**Against the criteria:**

- M1 passes (three slots, one at x4; the two x2 slots are fine for latency-bound CI). M2 passes (at least 64 GB; 96 or 128 GB is disputed, so S3 is unconfirmed). M3 passes on core count, though it is a lower-power part than the 5800X or the MS-A2's 16 cores.
- M4 is partial: Realtek, but two ports. M5: Proxmox reports are thin. M6: conflicting. M8: **7-day returns do not cover the acceptance test** (it includes a week of uptime); buying through a seller with a longer window, such as Amazon, might, but I did not check.
- S1: no PLP slot, but the OCuLink port could in principle carry a PCIe adapter for a U.2 drive. Not verified.

**Cost:** with 32 GB DDR5 SO-DIMM (priced at $400–560 on the same assumption as before) plus two 2 TB drives ($708), about **$1,520–1,680** from the $410 barebone, which would be the cheapest total found and leave about $900–1,100 of the $2,600. The low barebone price is from 2025 reviews, so it may be higher now.

Verdict: a cheap, low-power and flexible candidate (three drives, OCuLink) whose open questions are thermals, the 7-day return window and Realtek NICs. It is not a like-for-like replacement for the MS-A2 or MS-03 (fewer cores, lower power, and x2 slots).

**USB network adapters as a fallback.** Treat one as an add-on, not as the main link:

- The search found mixed Proxmox reports: Realtek RTL8156 adapters flapping or not passing VLAN tags, and a Proxmox 9 thread about a bridge dropping 3–5% of packets with several NIC types including a USB 2.5 Gb adapter (no resolution listed).
- Prefer an adapter whose driver is in the stock kernel (check with `ethtool -i`), and test it with `iperf3` under the acceptance test before relying on it.
- The onboard NIC should still work; a flaky onboard port (as reported on the SER10 Max) is the case where an adapter is useful.

## MS-A2 on the Minisforum store (read 2026-10-23)

Read from the [store page](https://store.minisforum.com/products/minisforum-ms-a2-workstation); prices and stock change, so re-check before ordering.

| Item      | Store page says                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU       | Ryzen 9 9955HX (16C/32T, 100 W turbo); the spec table also lists a 7945HX option. Check which one the variant you buy has                                                     |
| RAM       | Two DDR5 SO-DIMM, **up to 96 GB** (DDR5-5600 with the 9000-series chip, DDR5-5200 with the 7000 series)                                                                       |
| Storage   | **Slot 1:** M.2 2280 **or U.2**, PCIe 4.0 x4. **Slots 2 and 3:** M.2 2280 **or 22110**, PCIe 3.0 x4 by default, **switchable to PCIe 4.0 x4 in the BIOS**. RAID 0/1 supported |
| Network   | 2 × 10 GbE SFP+ (Intel X710), 2.5 GbE (Intel I226-V), 2.5 GbE (Realtek RTL8125), Wi-Fi 6E                                                                                     |
| Expansion | PCIe x16 slot at PCIe 4.0 x8 (can split into 2 × x4)                                                                                                                          |
| Cooling   | Three copper heat pipes, phase-change material, turbine fans                                                                                                                  |
| Size      | 196 × 189 × 48 mm, 1.4 kg                                                                                                                                                     |
| Warranty  | 2 years. **30-day money-back guarantee** and free RMA return                                                                                                                  |
| Shipping  | Free                                                                                                                                                                          |

| Variant (sale / regular)      | Stock                      |
| ----------------------------- | -------------------------- |
| Barebone: **$799** / $999     | in stock                   |
| 64 GB + 1 TB: $1,335 / $1,669 | shipping est. mid-November |
| 64 GB + 2 TB: $1,783 / $2,229 | in stock                   |
| 96 GB + 2 TB: $1,919 / $2,399 | out of stock               |
| (unlabelled): $2,159 / $2,699 | not stated                 |

The page labels the $799 price both "barebone" and "32GB RAM+1TB SSD", so confirm what it includes. A search also found $839.99 on Amazon (Slickdeals, January 2026) and $1,303 for a 32 GB + 1 TB configuration. The pre-configured variants carry a large RAM and SSD mark-up; the barebone is the better route.

**What this settles for the criteria:**

- **M1 pass, S1 pass.** Three M.2 slots, all PCIe 4.0 x4 (slots 2 and 3 after a BIOS switch). Slot 1 takes a **U.2** drive and slots 2–3 take **22110**, so a power-loss-protected data-centre drive fits. This is the PLP route the other candidates lacked (the MS-03 has a U.2 adapter).
- **M2 pass, S3 pass.** User-replaceable SO-DIMM, 96 GB ceiling, so 32 GB now and 96 GB later (replacing the sticks).
- **M3 pass** (16 cores). **M4 pass** (Intel I226-V and X710 onboard). **M7** not confirmed on the page.
- **M8 pass:** 30-day money-back, which covers the acceptance test (including a week of uptime) if you start it on arrival.
- **M5 and M6 still open:** reported spontaneous reboots on Proxmox kernels 6.17 and 6.14, noise of about 50 dBA in ServeTheHome testing, and heat complaints (see "MS-A2 owner reports" above). The 30-day window is the way to settle these.

**Rough cost (barebone):**

| Item                           | Price                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Barebone                       | $799 (store sale) to $839.99 (Amazon, January)                                         |
| 32 GB DDR5 SO-DIMM (2 × 16 GB) | about $400–560 (**assumption**: desktop DDR5 prices; SO-DIMM listings were unreliable) |
| 2 × 2 TB TLC NVMe with DRAM    | about $708 (WD SN850X at $354 each)                                                    |
| **Total**                      | **about $1,907–2,107** before tax, leaving about **$490–690** under $2,600             |

Cheaper drives lower the total: you need only two. Use the Gen4 x4 slot 1 for the boot/VM drive and keep a second slot free for a CI scratch drive or a 22110 PLP drive later. The drives I priced are 2280 TLC with DRAM; the research did not price 1 TB models, and **I did not price any U.2 or 22110 power-loss-protected drive**, so that is still a task.

**Cautions to carry into the purchase:**

- Check the BIOS version shipped, and **do not update it** until the reports are read: BIOS 1.03 reportedly broke passthrough and a downgrade bricked some units (second-hand report).
- Pin or test the Proxmox kernel against the reboot reports; one poster has three units stable on kernel 6.17.13-2 with BIOS 1.02.
- Measure idle power (one owner reported about 75 W idle, likely an outlier) and noise in your room.
- Set the slots 2–3 BIOS option to PCIe 4.0 before benchmarking.

## Before you buy: checklist

- [x] ELDERWAND's NVMe is a Corsair MP400 1 TB (QLC). [ ] (Original task:) Get ELDERWAND's actual NVMe model (`Get-PhysicalDisk` in PowerShell; see [Test commands](./2026-10-22-hardware-bottleneck.md#test-commands-copy-and-paste)); the Corsair page does not list it. Look up its sustained-write and sync-write benchmarks, and compare with the P3 Plus.
- [ ] Check how many jobs run on ELDERWAND at once and whether its runner service limits concurrency.
- [ ] Run the `fio` baseline from the analysis doc on the current host, so a new node can be compared with real numbers.
- [ ] Check the switch: ports, speed (1 / 2.5 / 10 GbE), free ports.
- [ ] Decide on quorum: standalone, QDevice, or three nodes.
- [ ] Shortlist 3 models. For each: slot count and lane widths, max RAM, NIC chip, idle watts, sustained-load temperature in a review, Proxmox reports.
- [ ] Shortlist drives (see the research tasks in the analysis doc for candidates) and check endurance and PLP.
- [ ] Check power: circuit, UPS capacity and runtime with the extra load.
- [ ] Pick a location with airflow. Heat was already a concern on the current box.
- [ ] Plan the first test after install: run the same `fio` jobs, then one fresh-SHA CI run on the new workers, and compare with the targets in the analysis doc (write latency under 5 ms, IO PSI under 0.15).
