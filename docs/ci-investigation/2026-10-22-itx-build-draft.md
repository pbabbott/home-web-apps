# Draft: mini-ITX build as the second Proxmox node (2026-10-22)

A DIY alternative to buying a mini PC, in a small ITX case, running Proxmox. It is judged against the [goals and criteria](./2026-10-22-hardware-purchase-criteria.md) ($2,600 budget, standalone Proxmox, switch below 2.5 GbE, multi-port preferred). Background: [bottleneck analysis](./2026-10-22-hardware-bottleneck.md), [buying guide](./2026-10-22-second-node-buying-guide.md).

**Status:** draft from web search, priced 2026-10-22 for Option B (section 8). Prices are mixed-date snapshots; the cooler, NIC and KVM are unpriced. Part choices are leads to verify, and nothing was tested.

## 1. Key finding: RAM prices decide the platform

Prices found for October 2026 (retailer snapshots that disagree with each other):

| Memory                             | Price found                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| DDR5 64 GB (2 × 32 GB) desktop kit | about **$1,000–1,300**; median $1,199; cheapest DDR5-5200 kit $814.99. Commentary blames AI data-centre demand |
| DDR4 64 GB (2 × 32 GB) desktop kit | about **$410–450** new (tracker, 22 Sep 2026); one retailer page showed $630–640 in April 2026                 |
| DDR4 64 GB (2 × 32 GB) SO-DIMM     | about $450 (cheapest was used or renewed; new from about $7 per GB)                                            |

Consequences:

- A 64 GB DDR5 kit alone would take **40–50% of the $2,600 budget**. The mini PCs in the [candidate list](./2026-10-22-second-node-buying-guide.md#candidates-web-research-2026-10-22) also use DDR5 SO-DIMM (I did not price those), so their totals are likely inflated the same way.
- **DDR4 is cheap by comparison**, so an AM4 platform saves the most. ELDERWAND is a Ryzen 7 5800X with DDR4 and is already fast.
- You do not have to fill the RAM now. A board with two slots can start at 32 GB and be replaced later (the criteria only require that the board _supports_ 64 GB). Worker VMs used 3–6.5 GB at p90 (peak 11.6 GB) of their 15 GB, so 32 GB hosts several workers. I did not price 32 GB kits.

## 1a. Decision: start with 32 GB, keep a high ceiling (2026-10-22)

You asked to start at 32 GB to stay in budget, with room to go much higher later. That changes the ranking.

**Prices for a 32 GB start:**

| Memory                           | Price found                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DDR5 32 GB (2 × 16 GB) desktop   | about **$400–560**: Corsair Vengeance DDR5-6000 CL30 at $559.99 (Amazon, TechRadar), $509.99 (Best Buy), CL36 at $499.99; G.Skill Flare X5 CL36 at $419.99 (Micro Center, older page); eBay $399.99. Mixed dates |
| DDR4 32 GB (2 × 16 GB) desktop   | **not found.** Half of the 64 GB DDR4 range ($410–450) would be about $205–225, but that is my arithmetic, not a listing                                                                                         |
| DDR5 SO-DIMM 2 × 16 GB (mini PC) | listings conflicted ($408.97 at one US reseller, $1,103–1,141 at another for the same kit), so no usable figure                                                                                                  |

**The ceiling problem.** These boards have only two DIMM slots, so an upgrade means replacing the sticks, not adding to them:

- **AM4 / DDR4 (Option A):** the two boards found list a **64 GB maximum**. That is 2× the start, not "much higher". The 4 × 32 GB 128 GB configurations in forum posts need four slots, which ITX boards do not have. I found nothing on 2 × 64 GB DDR4 on AM4.
- **AM5 / DDR5 (Option B):** two 48 GB sticks (96 GB) work on AM5 after a BIOS update (early 24/48 GB support was buggy). 64 GB sticks (128 GB) were "not yet available" in the forum thread I found, which dates from 2023–24, so their current availability and price are unknown. The MS-03 is listed at 128 GB.
- **Mini PCs:** MS-A2 listed at 96 GB, MS-03 at 128 GB, SER10 Max disputed (64 GB vs 256 GB).

**Effect on the ranking:**

1. **Option B (AM5 ITX) now leads for the DIY route.** A 32 GB DDR5 start costs about $150–300 more than a 32 GB DDR4 start (that gap uses my estimate for DDR4), which is small against $2,600. It keeps a path to 96 GB or more.
2. **Option A is the fallback** if the cheapest build matters more than the ceiling. Its proven CPU is a plus, but 64 GB is the end of the road, so a later jump means a new board and CPU.
3. **The mini PCs stay in the race.** The MS-03 pairs a 128 GB ceiling with U.2, vPro and four ports. Compare its price with Option B once priced.
4. **Starting with 2 × 16 GB** keeps dual-channel speed. The sticks are sold or reused when you move to 2 × 48 GB. A single 32 GB stick would be cheaper to leave in place but runs single-channel, which costs memory bandwidth. Not measured.

**Caveats for Option B:** the AM5 ITX boards found have a single Realtek or Killer 2.5 GbE port (not Intel), so criterion M4 needs a check of owner reports on Linux and the Proxmox kernel. A dual-port Intel card in the PCIe slot would remove that concern, at the cost of the slot (section 4). AM5 ITX board prices were not found.

## 2. Platform options

### Option A (cheapest, 64 GB ceiling): AM4 + DDR4, proven by ELDERWAND

| Part    | Choice                                                                                                 | Notes                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU     | **Ryzen 7 5800X** (8C/16T, same as ELDERWAND). Step-up: Ryzen 9 5950X (16C/32T, 105 W)                 | 5800X: seen at $180–200 in 2024 sources (stale). 5950X launched at $799, later sales $520–600 (2021–22, stale). The 5950X doubles cores but is the hardest part to cool in a small case. No current prices found           |
| Board   | **ASUS ROG Strix B550-I Gaming** or **ASRock B550 Phantom Gaming-ITX/ax**                              | Both: Intel I225-V 2.5 GbE, two M.2 (one CPU-attached Gen4 x4, one chipset Gen3 x4), two DDR4 slots, 64 GB maximum, Wi-Fi 6 (verify the ASRock's Wi-Fi card per SKU). Both are old boards; check availability, new or used |
| RAM     | 2 × 32 GB DDR4-3200, or 2 × 16 GB to start                                                             | About $410–650 for 64 GB (above)                                                                                                                                                                                           |
| Storage | 2 × TLC NVMe with DRAM, 1–2 TB each: boot and VM disks on the Gen4 slot, CI scratch on the other       | Pick from the drive research list in the analysis. ITX boards take 2280 only, so no 22110 power-loss-protected drive on board                                                                                              |
| Cooler  | Low-profile air cooler, or a 240 mm AIO if the case takes one                                          | Depends on the case. ELDERWAND runs a 240 mm AIO                                                                                                                                                                           |
| Case    | See section 3                                                                                          |                                                                                                                                                                                                                            |
| PSU     | SFX 450–650 W, 80+ Gold                                                                                | No GPU, so a 750 W unit is not needed. An 850 W unit in the NR200P MAX bundle is far more than this build uses                                                                                                             |
| Network | Onboard Intel 2.5 GbE (links at 1 GbE on your switch) plus an optional Intel dual-port 1 GbE PCIe card | See section 4                                                                                                                                                                                                              |

Idle power and noise are usually worse than a mini PC. I found no figures for this build.

### Option B (leading if you want a high RAM ceiling): AM5 + DDR5

| Part  | Choice                                                                               | Notes                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU   | Ryzen 7 9700X (8C/16T, 65 W) or Ryzen 9 9900X (12C/24T, 120 W)                       | 9900X: launch MSRP $499 (Best Buy listed $449), $354.86 on Amazon in 2025 (stale). 9700X: $359 MSRP at launch. The 9900X runs hottest of the three and needs an AIO or a strong air cooler; its 65 W ECO mode was called "not great" by one reviewer |
| Board | ASUS ROG Strix B850-I / X870-I, ASRock B850I Lightning, Gigabyte X870I Aorus Pro Ice | Mostly one 2.5 GbE port (Realtek or Killer on the ones found), two M.2. The ASRock A620AI WiFi has dual LAN but the controller maker was not given. No Intel-NIC AM5 ITX board was found                                                             |
| RAM   | DDR5, at $1,000+ for 64 GB                                                           | Could start with less; 32 GB kits not priced                                                                                                                                                                                                         |

Its advantages are a higher RAM ceiling and a newer platform. See section 1a for why this now leads. The RAM cost at 32 GB is much lower than at 64 GB.

## 3. Case

| Case                                                                                  | What the search found                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cooler Master NR200P / NR200P MAX**                                                 | Rated best airflow in several roundups: front fans, a 280 mm AIO fits, SFX-L PSU. The MAX bundle includes a 280 mm AIO and 850 W PSU (listed $250–350 in 2025; stale) |
| **Fractal Design Ridge**                                                              | About $157 for the white model in an undated listing (no PSU). One user says the configurator wants an SFX-L PSU. No review found                                     |
| Fractal Design Terra, Dan A4-SFX, NZXT H1 v2/H2 Flow, Hyte Revolt 3, SilverStone SG13 | Named in roundups; the A4-SFX is the smallest but leaves the least thermal headroom. Sliger and Jonsbo cases were not covered by the results                          |

Pick for airflow, not size: your current mini PC averages 87 °C, so a case with mesh panels and a 240–280 mm radiator or a tall air cooler is the point of going ITX. Check that the case fits the AIO or cooler height, the PSU length, and that you can reach both M.2 sockets (one is usually on the back of the board).

## 4. Network: multi-port on a 1 GbE switch

An ITX board has **one PCIe x16 slot**, and that slot cannot do two jobs:

- **Use it for a second NIC** (a dual-port Intel 1 GbE card, giving three ports total with the onboard one). Gives failover, or separate management and VM links if the switch is managed. It adds no speed on an unmanaged switch.
- **Or use it for storage** (a PCIe adapter for 22110 or U.2 power-loss-protected drives, or extra M.2). This is the only route to a PLP drive in this build.

You choose per goal: more ports, or a PLP scratch drive. With two TLC DRAM drives on board, the PLP drive is optional, and a switch upgrade to 2.5 GbE would make the onboard port more useful. If neither the NIC nor the PLP adapter is needed, leave the slot empty. I did not look up specific add-in cards or adapters.

Note from memory (verify before relying on it): early Intel I225-V controllers had a stepping bug that caused 2.5 GbE link problems. Later revisions fixed it. Check the board's revision and recent owner reports (criterion M4).

## 5. Fit against the criteria

| Criterion                         | Option A (B550-I + 5800X)                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 two or more M.2, one Gen4 x4   | pass (two M.2; one Gen4 x4 CPU slot)                                                                                                                            |
| M2 replaceable RAM, 64 GB or more | pass (64 GB maximum)                                                                                                                                            |
| M3 8 cores or more                | pass (8C/16T; 16C with a 5950X)                                                                                                                                 |
| M4 clean NIC record               | likely pass (Intel I225-V); verify revision                                                                                                                     |
| M5 Proxmox reports for this model | not checked. B550 boards are widely used for Proxmox, but I found nothing for these two                                                                         |
| M6 sustained cooling              | depends on the case and cooler chosen; a desktop-style case with a 240 mm AIO is the strongest option here. ELDERWAND is evidence the 5800X stays fast under CI |
| M7 BIOS options, auto power-on    | consumer boards normally have SVM/IOMMU and "restore on AC power loss"; verify in the manual                                                                    |
| M8 return window                  | depends on the retailer; buy parts from one that allows returns                                                                                                 |
| S1 PLP route                      | only by giving up the PCIe slot to an adapter                                                                                                                   |
| S2 multi-port                     | 1 onboard, +2 with a PCIe NIC (uses the slot)                                                                                                                   |
| S3 96 GB or more                  | **no** (64 GB maximum)                                                                                                                                          |
| S4 remote management              | none onboard. A PiKVM-style device would add it (not priced)                                                                                                    |
| S5 idle power                     | likely higher than a mini PC; not measured                                                                                                                      |

## 6. Mini PC or ITX build

|                       | ITX build (Option A)                                                             | Mini PC (MS-A2 / MS-03)                                                        |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cost                  | RAM is cheaper (DDR4). Other parts unpriced, so the total is **not established** | DDR5 SO-DIMM prices not checked. MS-03 barebone $759.99 (one source)           |
| Cooling               | Best potential: bigger radiator or cooler                                        | Reviews report 50–52 °C for MS-A2 under load                                   |
| Ports                 | 1 onboard (+2 with the slot)                                                     | 4 ports on both Minisforum models                                              |
| Storage options       | 2 × 2280 (+ adapter in the slot)                                                 | 3 × M.2, plus a U.2 route on the MS-03                                         |
| Remote management     | none                                                                             | vPro/AMT on the MS-03                                                          |
| Size and noise        | bigger, probably louder                                                          | smaller                                                                        |
| Build effort and risk | You assemble, update BIOS, and pick compatible parts                             | Ready to install; the risks are NIC, cooling and slot-lane issues from reviews |
| Support               | Parts warranties and returns separately                                          | One vendor                                                                     |

If cost matters most, and RAM is the big item, the ITX Option A is the likely cheaper route, but the saving needs the unpriced parts to confirm. If ports, remote management and a PLP route matter most, the MS-03 fits better.

## 7. Tasks before deciding

- [x] Price the main parts (done in section 8; re-check live). [ ] Price the cooler, a PCIe NIC and a PiKVM-style device.
- [ ] Confirm the B550-I boards are available new at a sane price, or look at used. If not, look for another DDR4 ITX board with an Intel NIC (AM4 or Intel).
- [ ] Look up Proxmox reports for the chosen board.
- [ ] Check the case supports the chosen cooler and reaches both M.2 sockets.
- [ ] Check the I225-V revision issue and recent owner reports.
- [ ] Run the baseline `fio` tests on ELDERWAND to see how fast the same CPU/NVMe class is, so the ITX build is judged against real numbers.
- [ ] Re-score the candidates in the criteria doc once prices are in.

## 8. Bill of materials, Option B (AM5, 32 GB start), priced 2026-10-22

Prices are web-search snapshots of mixed dates and retailers, so treat them as ranges and re-check live. Tax and shipping are not included. "Unpriced" means no usable listing was found.

| Part                               | Choice                                                                    | Price (low–high)       | Source / note                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU                                | Ryzen 7 9700X (8C/16T, 65 W). Alternative: Ryzen 9 9900X (12C/24T, 120 W) | $250–340               | $249.98 OEM at Newegg, about $310 at Amazon and B&H. 9900X was $328–339, sometimes cheaper than the 9700X. 120 W needs better cooling          |
| Motherboard                        | ASRock B850I Lightning WiFi (mini-ITX, AM5)                               | about $200–204         | TechSpot ($200, "by far the most affordable" mini-ITX B850) and Newegg ($203.99). LAN reported as Killer 2.5 GbE. M.2 count not confirmed      |
| RAM                                | 2 × 16 GB DDR5-6000 (start)                                               | $400–560               | See section 1a                                                                                                                                 |
| NVMe 1 and 2 (boot/VM, CI scratch) | 2 × WD Black SN850X 2 TB (TLC, DRAM)                                      | about $354 each, $708  | $354 at Newegg (11 Oct), $382 earlier. 1 TB drives not priced. Avoid DRAM-less/QLC drives, such as the cheaper Crucial P310 at $253 (see note) |
| Cooler                             | Low-profile or 240 mm AIO, depending on the case                          | unpriced               | No listing found. Reserve budget                                                                                                               |
| Case                               | Cooler Master NR200P V3                                                   | $120–165               | $131.99 (Amazon), $119.99–128.99 (Newegg), $99.99 special at one reseller. Walmart/PriceSpy results higher and likely stale                    |
| PSU                                | Corsair SF750 (SFX, Platinum)                                             | $184.99                | Corsair US store. An SFX 450–650 W unit would suffice and might cost less; SF650 not priced                                                    |
| PCIe NIC or storage adapter (opt)  | Intel dual-port 1 GbE card, or a PLP adapter                              | unpriced               |                                                                                                                                                |
| Remote KVM (opt)                   | PiKVM-style device                                                        | unpriced               |                                                                                                                                                |
| **Subtotal (priced parts)**        |                                                                           | **about $1,860–2,160** | Without cooler, options, tax and shipping                                                                                                      |
| **Headroom vs $2,600**             |                                                                           | **about $440–740**     | For the cooler, tax and shipping, and options. Drives are the largest line: NAND prices are up too                                             |

Note on the P310: I recall it as DRAM-less QLC but did not verify it in these results; check before ruling it in or out.

Ways to lower the subtotal: one 2 TB drive plus a smaller second one (smaller drives not priced); a cheaper PSU; the 9700X rather than the 9900X.

### Option A (AM4) for comparison

Not re-priced: no current prices were found for AM4 CPUs or the B550-I boards, and those boards are old, so availability is uncertain. The RAM saving is about $150–300 (DDR4 32 GB estimate from section 1a). The 64 GB ceiling remains the reason it is behind.

### Mini PC for comparison (same 2 × 2 TB drives, 32 GB RAM)

| Item               | MS-03 (Core Ultra)                                                                                    | MS-A2 (9955HX)                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Barebone           | $759.99 (Core Ultra 5 336H), $949–999 (Core Ultra 9 386H); Amazon and store figures differ            | $799 sale ($999 regular) on an old store snapshot; a March 2026 report says $799 still applies, and $559 is the 7945HX model |
| 32 GB DDR5 SO-DIMM | unreliable listings; assuming it costs about the same as desktop DDR5 gives $400–560 (**assumption**) | same assumption                                                                                                              |
| 2 × 2 TB NVMe      | about $708                                                                                            | about $708                                                                                                                   |
| **Total (rough)**  | **about $1,870–2,270**                                                                                | **about $1,910–2,070**                                                                                                       |

Read: **the DIY AM5 build and the mini PCs land in the same range** ($1,860–2,270), so the DIY build is not clearly cheaper once RAM and NAND are this expensive. The case, PSU and cooler (about $300+) roughly cancel the mini PC's barebone premium. Pick on criteria, not price:

- DIY AM5: bigger cooling headroom; one NIC (Killer/Realtek); no remote management.
- MS-03: four ports with Intel X710/i226, vPro, U.2 route, 128 GB ceiling, smaller; but cooling and lane details are unverified (conflicting reports).
- MS-A2: three Gen4 x4 slots, 16 cores, four ports, 96 GB ceiling; fan noise 41–43 dB under load in one review.

## 9. Open items

- [ ] Confirm the B850I Lightning's M.2 count, lane widths, LAN controller and a BIOS that supports 48 GB DIMMs. The TechPowerUp review page returned a 403 error, so it was not read.
- [ ] Price the cooler (low-profile and 240 mm AIO) and check it against the NR200P V3 clearances.
- [ ] Price a PCIe Intel NIC and a PiKVM-style device.
- [ ] Price 1 TB TLC/DRAM drives, which may lower the storage cost.
- [ ] Get live MS-03 and MS-A2 prices from the Minisforum store and Amazon, plus a real DDR5 SO-DIMM 2 × 16 GB price.
- [ ] Run the `fio` baseline on ELDERWAND and the current host.
- [ ] Decide between DIY AM5, MS-03, MS-A2, and record it in the criteria doc's decision log.

## Sources

- [DDR5 Price Tracker 2026 (capitalandcompute.net)](https://capitalandcompute.net/memory-prices/ddr5/)
- [64GB DDR5 RAM prices in the US, Oct 2026 (pgrid.app)](https://www.pgrid.app/us/advice/compare-64gb-ddr5-ram)
- [Best DDR5 RAM 2026 (computingforgeeks.com)](https://computingforgeeks.com/best-ddr5-ram-homelab-workstation/)
- [64GB DDR4 RAM live prices (datacenterdisk.com)](https://datacenterdisk.com/ram/ddr4/64gb)
- [ASUS ROG Strix B550-I Gaming specs](https://rog.asus.com/sg/motherboards/rog-strix/rog-strix-b550-i-gaming-model/spec)
- [ASRock B550 Phantom Gaming-ITX/ax (notebookspec.com)](https://notebookspec.com/pc-mb/1440-asrock-b550-phantom-gaming-itxax.html)
- [Best Mini-ITX motherboards 2026 (PC Gamer)](https://www.pcgamer.com/hardware/motherboards/best-mini-itx-motherboards/)
- [Ryzen 9 9900X review (hwbusters)](https://hwbusters.com/cpu/amd-ryzen-9-9900x-cpu-review-performance-thermals-power-analysis/)
- [Ryzen 9 9900X new best price (Club386)](https://www.club386.com/amd-ryzen-9-9900x-tumbles-to-new-best-ever-price/)
- [Ryzen 9 5950X price history (Tom's Hardware)](https://tomshardware.com/news/amd-ryzen-9-5950x-new-low-newegg)
- [Cooler Master NR200P review (bit-tech)](https://www.bit-tech.net/reviews/tech/cases/cooler-master-nr200p-review/1/)
- [Best Mini ITX Cases 2026 (sunbeamtech.com)](https://sunbeamtech.com/pc-building/best-mini-itx-case-sff-guide/)
