# Hardware and infra bottleneck analysis (2026-10-22)

Question: after the repo-side cache fixes, CI still takes 40–60 min. Which resource is the ceiling (CPU, memory, IO, network), what infra changes could help, and what hardware would make CI fast?

**Documentation only.** Nothing in the cluster, Proxmox host, ARC values or workflows was changed. Read-only `ssh` to the Proxmox host and one worker, `kubectl get`, and Prometheus queries.

- **Runs analysed:** 19 `ci.yml` runs created since 2026-10-15 (runs with re-attempts use their last hour). Earlier per-run detail: [run 39792454420](./2026-10-22-39792454420.md), [attempt 3](./2026-10-22-39676588103-attempt-3.md), [main investigation](./2026-10-21-39665721971.md).
- **Statistics below** are avg / p90 / max over every 1-minute sample in those windows (`query_range`, `step=60`, 2 min rate).

## Summary

1. **Disk IO is the ceiling.** All Kubernetes VM root disks sit on one consumer DRAM-less QLC NVMe, and it is at 78% busy on average and 96% at p90 during CI. This is proven by the metrics.
2. **CPU is a secondary limit**, bursty, made worse by 1-core container limits. The host also runs hot (87 °C average).
3. **Memory and network are not limits** for CI. The Proxmox host itself has almost no free RAM (about 2 GB), which leaves no page cache for the disk.
4. **Two infra settings probably multiply the disk load** (online `discard` in the workers and LVM-thin zeroing). Both are cheap to test. The effect size is not measured.
5. **The hardware has one M.2 slot**, so the disk can be replaced but not supplemented. The two hardware paths are a better drive in the same box, or a separate CI machine.
6. ELDERWAND runs the same jobs 4–11× faster. It is a Corsair a7200 prebuilt: Ryzen 7 5800X (8C/16T, the same core count as the Beelink), 16 GB RAM, one 1 TB NVMe of unlisted model, 1 GbE ([specs](https://www.corsair.com/us/en/p/gaming-computers/cs-9050009-na/vengeance-a7200-gaming-pc-r7-5800x-rtx-3070-1tb-m-2-16gb-ddr4-3200-cs-9050009-na), as sold). So the gap is probably not CPU count or RAM but the storage path: bare metal, no VM/LVM-thin layers, no shared disk. See the [buying guide](./2026-10-22-second-node-buying-guide.md#reference-what-elderwand-is). Purchase goals and criteria: [hardware purchase criteria](./2026-10-22-hardware-purchase-criteria.md).

## Evidence

All values avg / p90 / max.

| Resource                                       | Observation                                                                                                                                                                 | Verdict                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Host disk `nvme0n1` (Crucial P3 Plus, QLC)     | busy 0.78 / 0.96 / 1.00; queue depth 25 / 47 / 226; write latency 22 / 46 / 187 ms; read latency 13 / 24 / 53 ms; writes 42 / 108 / 291 MB/s; reads 5 / 11 / 41 MB/s        | **Saturated. Primary limit** |
| Guest disk (`sda` in workers)                  | write latency **52 / 116 / 758 ms** (all three workers alike); writes 12–13 MB/s avg per worker                                                                             | Same limit, seen from inside |
| Worker pressure (PSI)                          | IO 0.45 / 0.82 / 0.92; CPU 0.10–0.15 / 0.26–0.45 / 0.99; memory ~0                                                                                                          | IO stalls dominate           |
| Worker CPU                                     | user+sys 22 / 48–64 / 91% (busy incl. iowait 55%); iowait 31 / 67 / 82%; steal <0.1%                                                                                        | Not CPU-bound on average     |
| Host CPU (Ryzen 7 5800H)                       | user+sys 25 / 51 / 68%; iowait 12 / 22 / 26%; PSI CPU ~0.01                                                                                                                 | Not a limit                  |
| Runner container CPU throttling                | `runner` container 12 / 42 / 95% of periods throttled; `dind` 2 / 6 / 31%; `github-actions-cache-server` 11 / 49 / 73%. All `arc-runners` pods: 0.86 / 2.4 / 6.8 cores used | Secondary, bursty            |
| Host temperature and clock                     | CPU sensor max 87 / 92 / 93 °C; clock 3.8 GHz avg                                                                                                                           | Watch item                   |
| Worker memory                                  | 9–12 GB available of 15 GB, memory PSI ~0                                                                                                                                   | Not a limit                  |
| **Host memory**                                | **2.2 GB available** (min near 0; 61 GB of 64 GB allocated to VMs, balloon off)                                                                                             | No page cache for the host   |
| Network `enp1s0` (1 GbE)                       | rx 3.8 / 9.8 / 35 MB/s, tx 1.2 / 2.8 / 20 MB/s                                                                                                                              | Not a limit                  |
| Second host disk `sda` (Crucial BX500, SATA)   | busy 0.05 / 0.06 / 0.74                                                                                                                                                     | Idle, not involved           |
| Who writes (`container_fs_writes_bytes_total`) | `arc-runners` 44 / 122 / 387 MB/s. Next largest namespace (`longhorn-system`) 2 MB/s                                                                                        | CI is the writer             |

Shape matches every earlier run doc: fast for the first 10 minutes while the drive is idle, then at 90%+ busy with 30–60 ms latency.

## Hardware and layout (as found)

| Item         | Value                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host         | Proxmox 8.2.4, kernel 6.8.8-4-pve, hostname `chimaera`. DMI vendor `AZW`, product `SER` (a Beelink SER-series mini PC; exact model not established) |
| CPU          | AMD Ryzen 7 5800H, 8C/16T                                                                                                                           |
| RAM          | 2 × 32 GB DDR4-3200 (64 GB)                                                                                                                         |
| NIC          | Realtek RTL8111/8168, 1 Gb/s                                                                                                                        |
| `nvme0n1`    | Crucial P3 Plus 1 TB `CT1000P3PSSD8` (QLC, DRAM-less, Micron 2550 controller). 48.5 TB written, 5% wear, 49 °C idle                                 |
| `sda`        | Crucial BX500 2 TB `CT2000BX500SSD1` (SATA, DRAM-less)                                                                                              |
| Free slots   | `dmidecode` lists one M.2 socket in use, a PCIe x8-size slot and other M.2 sockets "available". Whether they are usable is **not established**      |
| IO scheduler | `none` on `nvme0n1` (default for NVMe)                                                                                                              |

Storage pools: `local-lvm` (thin, on `nvme0n1`, 40% used), `fast-ssd` (thin on `sda`, 35%), `etcd-ssd` (thin on `sda`, 6%).

| VM                        | State   | vCPU | RAM    | Root disk (`scsi0`)    | Extra disks                                                         |
| ------------------------- | ------- | ---- | ------ | ---------------------- | ------------------------------------------------------------------- |
| 204 controller-1          | running | 4    | 6 GB   | `local-lvm` 32 GB      | `fast-ssd` 256 GB (500 IOPS / 200 MB/s write cap), `etcd-ssd` 20 GB |
| 205, 206, 207 workers 1–3 | running | 4    | 15 GB  | `local-lvm` 60 GB each | same as above                                                       |
| 500 `marauders-map`       | running | 6    | 10 GB  | `local-lvm` 135 GB     | none                                                                |
| 301–304 nonprod           | stopped | 4    | 3–4 GB | `local-lvm`            | stopped, no load                                                    |

All prod VMs use `cpu: host`, `virtio-scsi-single`, `iothread=1`, `discard=on`, `ssd=1`, no `cache=` setting (default `none`). Total vCPU running: 22 on 16 host threads.

Runner pods (from `kubectl get autoscalingrunnersets`):

- `prod-gen2-dind-runner`: min 2, max 9. `runner` 250m request / 1 CPU / 3 Gi limit; `dind` 100m / 1 CPU / 3 Gi. `var-lib-docker` emptyDir (limit 20 Gi) and `work` emptyDir (limit 10 Gi) both on the worker root disk.
- `prod-gen2-amd64-runner`: min 2, max 8. 500m request, 1.25 CPU / 4 Gi limit.
- Self-hosted runners `ELDERWAND` and `ELDERWAND-2` carry the same labels, so jobs land on either them or the pods.

## Causes (what is proven and what is not)

| #   | Cause                                                                                                                                                                                                                                                                                                                                                                        | Status                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Every VM root disk (3 workers, controller, `marauders-map`) shares one DRAM-less QLC drive. Docker layers, `node_modules` extraction and containerd all land on it.                                                                                                                                                                                                          | Proven (layout and metrics)                                             |
| 2   | Workers mount `/` with online `discard` (`/dev/sda1 / ext4 rw,relatime,discard,...`) and `fstrim.timer` is also enabled (checked on worker-1 only). Deleting emptyDir data when a pod ends sends TRIM through `virtio-scsi` (`discard=on`) and LVM-thin (`passdown`) to the drive. The host shows **27 / 48 / 104 MB/s of discards on `nvme0n1`** against 42 MB/s of writes. | Discard traffic is measured. That it slows other IO is a hypothesis     |
| 3   | `pve/data` thin pool has block zeroing on (`zero`, 64 KiB chunks). After a discard unmaps chunks, the next write provisions and zeroes a chunk first, adding writes for small-file workloads.                                                                                                                                                                                | Setting is measured. Cost is a hypothesis                               |
| 4   | The drive has no power-loss protection and sees about 25 flushes/s (avg, max 126). Without PLP a flush waits for the NAND write.                                                                                                                                                                                                                                             | Flush rate measured. Cost is a hypothesis                               |
| 5   | Oversubscription: up to 9 dind and 8 amd64 runner pods (peak 13 observed) on 12 worker vCPU and one disk. More parallel jobs lengthen the slow tail.                                                                                                                                                                                                                         | Pod counts measured. Effect of capping is untested                      |
| 6   | Host RAM is fully allocated (61 of 64 GB to VMs, balloon off), leaving the host about 2 GB for its own page cache and LVM metadata.                                                                                                                                                                                                                                          | Measured. Effect on IO is a hypothesis                                  |
| 7   | 1-core limits on `runner` and `dind` throttle CPU work that is not waiting on disk.                                                                                                                                                                                                                                                                                          | Measured (p90 42%)                                                      |
| 8   | The SLC cache of the P3 Plus runs out under sustained writes, so throughput falls with latency rising.                                                                                                                                                                                                                                                                       | **Consistent with the metrics, not demonstrated.** Needs `fio` (task 5) |

Note on the discard figure: node_exporter's `node_disk_discarded_sectors_total` also counts the `dm-*` layers, so only the physical `nvme0n1` value (27 MB/s avg) is used here.

## Steps you can take (none applied)

Do one at a time. After each, push a fresh commit (a re-run of the same SHA skips builds), run CI, and compare against the targets below using the PromQL at the end.

**Targets after a good change:** `nvme0n1` write latency avg under 5 ms; guest `sda` write latency under 10 ms; `nvme0n1` discards near 0 during runs; worker IO PSI under 0.15; no 20-minute step timeouts.

| #   | Change                                                                                                                                                                                                            | Where                                      | Risk                                   | Expected effect (unmeasured)                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- | -------------------------------------------- |
| 1   | Remove `discard` from the root mount options on the 3 workers; keep the weekly `fstrim.timer`. Source of the fstab entry is not found yet (research task 6).                                                      | Workers' `/etc/fstab` or provisioning code | Low                                    | Discard traffic to about 0 during runs       |
| 2   | Turn off thin-pool zeroing: `lvchange -Z n pve/data` (also `vg_fast/data`). Stale blocks may be readable by another VM on this host; acceptable for a one-owner homelab.                                          | Proxmox host                               | Low                                    | Fewer small writes after discards            |
| 3   | Lower concurrency: ARC `maxRunners` 9→4 (dind) and 8→4 (amd64); `max-parallel: 6`→3 in `.github/workflows/ci.yml` (docker-build matrix, line 192).                                                                | ARC values (gitops), `ci.yml`              | Low, may lengthen the queue            | Shorter slow tail, fewer timeouts            |
| 4   | Raise or remove CPU limits: `runner` and `dind` 1→3 CPU, or keep requests only.                                                                                                                                   | ARC values                                 | Low (noisy-neighbour on services)      | Less throttling at p90                       |
| 5   | Give the host RAM back: workers 15→12 GB (they sit at 9–12 GB free). Then optionally add a scratch virtual disk per worker (`cache=unsafe`, no `discard`) for `/var/lib/kubelet` emptyDirs and `/var/lib/docker`. | Proxmox VM config, worker mounts           | Medium (data on scratch is disposable) | Host page cache absorbs flushes              |
| 6   | Optional: `emptyDir: {medium: Memory}` for the runner `work` volume. Needs pod memory limit increases.                                                                                                            | ARC values                                 | Medium                                 | Removes workspace IO. Try on one job first   |
| 7   | Move heavy jobs (docker-build, UI tests) to ELDERWAND-class hardware by giving it a dedicated label.                                                                                                              | `ci.yml` `runs-on`, runner labels          | Low                                    | Immediate: those jobs ran 4–11× faster there |

Steps 1–2 are the best first experiment: no purchase, no downtime beyond a worker remount, and they act on a measured traffic source.

### Hardware paths

| Path                    | What                                                                                                                                                                                                        | Cost (rough, check current prices) | Why                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A. Drive swap           | Replace the P3 Plus with an M.2 2280 NVMe that has DRAM and sustains writes: PLP data-centre drive preferred, DRAM TLC consumer drive acceptable. Migrate VM disks with `vzdump`/restore or `qm move-disk`. | about $100–250                     | Targets the proven ceiling. A PCIe 4.0 drive will run at 3.0 speed in this box, which is fine for a latency-bound workload. |
| B. Dedicated CI machine | Separate bare-metal box for runners: 12–16 fast cores, 64 GB, two or more NVMe (one with PLP for docker/runner scratch). Keep the Beelink for services.                                                     | about $600–1,500                   | ELDERWAND already shows the shape works. Also removes CI IO from the services' disk and the 87 °C thermal envelope.         |
| C. Use ELDERWAND more   | Add runner capacity on ELDERWAND-class machines and route heavy jobs via labels (step 7).                                                                                                                   | $0 now                             | Fastest test of the "buy a machine like this" idea, using hardware already owned.                                           |

Not worth buying: RAM (not a limit, and 64 GB is the 5800H maximum), NIC (traffic peaks at 35 MB/s on a 125 MB/s link).

## Follow-up research tasks

Check these off later. Model numbers are from memory or drive catalogues: **verify each before buying.**

1. **Benchmark the current drives from online reviews** (look for sustained / post-SLC write speed, 4K QD1 sync-write latency, behaviour under TRIM, and whether a DRAM-less drive uses host memory buffer):
   - [ ] Crucial P3 Plus 1 TB, `CT1000P3PSSD8`
   - [ ] Crucial BX500 2 TB, `CT2000BX500SSD1`
2. **Benchmark candidate replacement drives** (M.2 **2280** only; confirm length, single-sided or heatsink clearance in the Beelink):
   - [ ] PLP / data-centre: Micron 7450 PRO 960 GB M.2 2280 (`MTFDKBA960TFR`); Kingston DC2000B 960 GB (`SEDC2000BM8/960G`)
   - [ ] DRAM TLC consumer: WD SN850X 1 or 2 TB (`WDS100T2X0E`, `WDS200T2X0E`); Samsung 990 Pro 1 or 2 TB (`MZ-V9P1T0`, `MZ-V9P2T0`); Kingston KC3000 1 TB (`SKC3000S/1024G`)
   - [ ] For each: price per TB, endurance (TBW), sustained write once cache is full, 4K QD1 sync write latency, idle and load temperature, PLP yes/no
3. **Identify the exact Beelink model** (`dmidecode -s system-version`, or read the label under the case) and look up its M.2 slot(s), PCIe generation, and whether a second NVMe is possible via a spare socket or the PCIe x8-size slot.
   - [ ] model, [ ] slot list, [ ] drive-height and heatsink limits
4. **Confirm ELDERWAND's parts.** CPU, RAM and board are known from the Corsair page (Ryzen 7 5800X, 16 GB, MSI B550-A PRO); the NVMe model is not. ELDERWAND runs Windows 11, so use the PowerShell commands in [Test commands](#test-commands-copy-and-paste).
   - [x] CPU, [x] RAM, [ ] drive model(s), [ ] how many jobs run on it at once
   - [ ] **Where the runner actually runs.** GitHub lists ELDERWAND's OS as `Linux`, but the machine runs Windows 11. The runner is therefore probably inside WSL2 or a VM, which puts a virtual disk (`ext4.vhdx`) between jobs and the NVMe. Section A5 shows how to check. This changes what "bare metal" means above.
   - This sets the target spec for path B and shows how much of the 4–11× is disk vs CPU.
5. **Run a controlled `fio` benchmark** in an idle window. Commands for ELDERWAND (Windows), a Proxmox worker VM and the Proxmox host are in [Test commands](#test-commands-copy-and-paste). Run the host test only in an idle window; it loads the shared disk.
   - [ ] 4 KiB random write, QD32, 60 s
   - [ ] 4 KiB write with `fsync` after each, QD1, 60 s (the flush cost)
   - [ ] 1 MiB sequential write for 5 min (shows when the SLC cache runs out)
   - [ ] a discard run (write a file, delete it, `fstrim`), watching latency
   - Example: `fio --name=sync4k --filename=/dev/pve/scratch --rw=randwrite --bs=4k --iodepth=1 --fsync=1 --direct=1 --runtime=60 --time_based`
6. **Find where worker `discard` is set** (cloud-init, Ansible, Terraform in a repo outside this one?) so change 1 can be made in code, not by hand.
   - [ ] fstab source, [ ] confirm all three workers, not just worker-1
7. **Check the Beelink's thermals**: 93 °C max CPU sensor at 3.8 GHz. Look at fan curve, thermal paste age, and ambient temperature. A hot enclosure will limit path A as well.
   - [ ] BIOS fan profile, [ ] repaste, [ ] airflow
8. **Price path B options** against path A's measured gain: Minisforum MS-01 / MS-A2 (several NVMe, 10 GbE), or a Ryzen 9 desktop. Decide after tasks 4 and 5.
   - [ ] shortlist, [ ] cost, [ ] power draw, [ ] does it run as a Proxmox node or bare-metal runner host
9. **Decide whether to keep Proxmox thin LVM** or move the CI VM disks to a plain LV, `ext4`/`xfs` directory storage, or ZFS with a separate log device. Thin provisioning plus discard is the combination suspected in cause 3.
   - [ ] read Proxmox docs on thin zeroing and chunk size, [ ] decide

## Test commands (copy and paste)

Nothing here has been run. The commands are written from memory of each tool's options, so if one errors, check `fio --help` or the tool's docs and adjust. Record results in a table like the one at the end of this section.

Use the same four tests everywhere so the numbers compare. Each test file must be bigger than any cache: the sequential test writes 30 GB so it can pass the SLC cache of a consumer drive.

| Test | What it shows                                                                    |
| ---- | -------------------------------------------------------------------------------- |
| T1   | 4 KiB random write, queue depth 32, 60 s: small-file write rate (IOPS)           |
| T2   | 4 KiB write with a flush after each, queue depth 1, 60 s: latency of a flush     |
| T3   | 1 MiB sequential write, 5 min, bandwidth printed every 15 s: SLC cache exhausted |
| T4   | Delete the test file, then trim: whether discards stall the drive                |

### A. ELDERWAND (Windows 11, PowerShell)

**A1. Hardware inventory** (no admin needed for most; open PowerShell as administrator if a command is refused):

```powershell
# Drive model, type, size, health: this answers "which NVMe is it?"
Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, @{n='SizeGB';e={[math]::Round($_.Size/1GB)}}, HealthStatus | Format-Table -AutoSize

# Firmware, wear, temperature, bytes written
Get-PhysicalDisk | Get-StorageReliabilityCounter | Select-Object DeviceId, Wear, Temperature, PowerOnHours, ReadErrorsTotal, WriteErrorsTotal | Format-Table -AutoSize

# Which partitions / drive letters sit on which disk
Get-Partition | Where-Object DriveLetter | Select-Object DriveLetter, DiskNumber, @{n='SizeGB';e={[math]::Round($_.Size/1GB)}} | Format-Table -AutoSize

# CPU and RAM
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer, PartNumber, @{n='GB';e={$_.Capacity/1GB}}, Speed
```

Write down `FriendlyName` (the drive model), `MediaType` and `BusType` (should say `SSD` and `NVMe`). Then search the model name plus "review sustained write" and "4K QD1 write".

**A2. Free space.** You need about 35 GB free on the drive under test:

```powershell
Get-PSDrive C | Select-Object Used, Free
```

**A3. Install `fio`** (pick one; check the version it installs):

```powershell
winget search fio          # find the package id, then: winget install <id>
# or: choco install fio     # if Chocolatey is installed
# or: download the Windows build from https://github.com/axboe/fio/releases and unzip it
```

Open a **new** PowerShell window afterwards and check with `fio --version`.

**A4. Run the four tests.** Replace `C` with the drive letter that holds your runner's work folder (see A5). In `fio` on Windows the colon in the path must be escaped as `\:`.

```powershell
New-Item -ItemType Directory -Force C:\fiotest | Out-Null
$f = 'C\:\fiotest\fio.bin'

# T1: 4 KiB random write, QD32, 60 s
fio --name=T1 --filename=$f --size=4G --ioengine=windowsaio --direct=1 --rw=randwrite --bs=4k --iodepth=32 --runtime=60 --time_based --group_reporting

# T2: 4 KiB write with a flush after each write, QD1, 60 s
fio --name=T2 --filename=$f --size=1G --ioengine=windowsaio --direct=1 --rw=randwrite --bs=4k --iodepth=1 --fsync=1 --runtime=60 --time_based --group_reporting

# T3: 1 MiB sequential write, 30 GB file, 5 min; bandwidth is printed every 15 s
fio --name=T3 --filename=$f --size=30G --ioengine=windowsaio --direct=1 --rw=write --bs=1M --iodepth=8 --runtime=300 --time_based --status-interval=15

# T4: delete the file, trim the volume
Remove-Item C:\fiotest\fio.bin
Optimize-Volume -DriveLetter C -ReTrim -Verbose
```

Read these lines from each `fio` result:

- T1: `write: IOPS=`, `BW=`, and the `clat` (completion latency) `avg` and `99.00th` percentile.
- T2: `clat` `avg` and `99.00th` (microseconds). Flush latency is the figure to compare.
- T3: the `BW` in each 15-second status line. Note the time when it drops, and the speed before and after.
- T4: no number; watch whether the machine feels stalled while `ReTrim` runs.

**Cleanup:**

```powershell
Remove-Item C:\fiotest -Recurse -Force -ErrorAction SilentlyContinue
```

**A5. Find out where the runner runs, and how many jobs at once.** GitHub lists ELDERWAND's OS as Linux, so the runner is probably in WSL2 or a VM:

```powershell
wsl --list --verbose                      # is a distro running? which version?
Get-VM -ErrorAction SilentlyContinue      # Hyper-V VMs (admin PowerShell)
Get-Service | Where-Object Name -like 'actions.runner*'   # a Windows-service runner
Get-Process | Where-Object ProcessName -match 'Runner.Listener|Runner.Worker|docker|vmmem|wslhost' | Select-Object ProcessName, Id, WorkingSet
```

If there is a WSL distro, run these inside it (`wsl`):

```bash
df -h /                    # size and free space of the distro's disk
mount | grep ' / '         # filesystem type (ext4 on a .vhdx file?)
ls ~ /opt 2>/dev/null | grep -i runner
ps aux | grep -E 'Runner.(Listener|Worker)' | grep -v grep
docker info 2>/dev/null | grep -E 'Storage Driver|Docker Root Dir|Server Version'
```

On Windows, find the `.vhdx` file and the drive it lives on (this is the drive the tests should target):

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Packages" -Recurse -Filter ext4.vhdx -ErrorAction SilentlyContinue | Select-Object FullName, @{n='GB';e={[math]::Round($_.Length/1GB,1)}}
```

Two runners are registered (`ELDERWAND` and `ELDERWAND-2`). Check whether both live on this one machine; if so they share one drive. The count of jobs that ran at once on ELDERWAND in a past CI run is visible in the run's job list (runner name column).

For a fair comparison with CI, also run T1–T4 inside WSL (a Linux file path such as `/tmp/fiotest`), using the Linux commands in section B. The gap between the Windows result and the WSL result is the cost of the virtual disk layer.

### B. Linux: a Proxmox worker VM and the Proxmox host

**B1. Inside a worker VM (shows what CI sees: ext4 on `virtio-scsi` on LVM-thin).** Use a throwaway directory on `/` and delete it afterwards. Run on **one** worker, and not while CI is running there:

```bash
sudo apt-get install -y fio     # if not installed
mkdir -p /var/tmp/fiotest && cd /var/tmp/fiotest

fio --name=T1 --directory=. --size=4G  --ioengine=libaio --direct=1 --rw=randwrite --bs=4k --iodepth=32 --runtime=60  --time_based --group_reporting
fio --name=T2 --directory=. --size=1G  --ioengine=libaio --direct=1 --rw=randwrite --bs=4k --iodepth=1  --fsync=1 --runtime=60 --time_based --group_reporting
fio --name=T3 --directory=. --size=30G --ioengine=libaio --direct=1 --rw=write     --bs=1M --iodepth=8  --runtime=300 --time_based --status-interval=15
rm -f /var/tmp/fiotest/*.0 /var/tmp/fiotest/*.0.* ; sync
time sudo fstrim -v /          # T4
cd / && rm -rf /var/tmp/fiotest
```

Check `df -h /` first; the T3 file needs 30 GB free (workers have 60 GB disks and about half is used, so it may not fit. Lower `--size` to 15G and say so in the results).

**B2. On the Proxmox host (shows the raw drive, without guest layers).** Use a scratch thin volume, never a live VM disk. Only in an idle window, because it loads the shared drive:

```bash
# create a 40 GB scratch thin volume in the pve/data pool
lvcreate -V 40G -T pve/data -n fio-scratch

fio --name=T1 --filename=/dev/pve/fio-scratch --size=4G  --ioengine=libaio --direct=1 --rw=randwrite --bs=4k --iodepth=32 --runtime=60  --time_based --group_reporting
fio --name=T2 --filename=/dev/pve/fio-scratch --size=1G  --ioengine=libaio --direct=1 --rw=randwrite --bs=4k --iodepth=1  --fsync=1 --runtime=60 --time_based --group_reporting
fio --name=T3 --filename=/dev/pve/fio-scratch --size=30G --ioengine=libaio --direct=1 --rw=write     --bs=1M --iodepth=8  --runtime=300 --time_based --status-interval=15

# T4: discard the whole scratch volume and watch the stall
time blkdiscard /dev/pve/fio-scratch

# remove the scratch volume
lvremove -y pve/fio-scratch
```

Before step one, confirm no volume named `fio-scratch` exists (`lvs pve`). The `fio` commands above write only to `/dev/pve/fio-scratch`.

While T3 runs on the host, a second terminal can watch the drive: `iostat -x nvme0n1 5` (install `sysstat` if missing), or the Prometheus latency query in the PromQL section.

**B3. Inside WSL on ELDERWAND:** same commands as B1, using `/tmp/fiotest` and skipping `fstrim` (not supported on a `.vhdx`).

### Results table

| Test                        | Proxmox host (raw LV) | Proxmox worker VM (ext4) | ELDERWAND Windows (NTFS) | ELDERWAND WSL (ext4) |
| --------------------------- | --------------------- | ------------------------ | ------------------------ | -------------------- |
| T1 IOPS / p99 latency       |                       |                          |                          |                      |
| T2 IOPS / avg latency / p99 |                       |                          |                          |                      |
| T3 MB/s first 30 s          |                       |                          |                          |                      |
| T3 MB/s last 60 s           |                       |                          |                          |                      |
| T3 time when speed drops    |                       |                          |                          |                      |
| T4 observed stall           |                       |                          |                          |                      |

How to read it:

- Worker VM much slower than host raw LV: the guest layers (`virtio-scsi`, thin-LVM, `discard`) cost the most.
- Host raw LV much slower than ELDERWAND Windows: the drive itself, since both are close to bare metal.
- ELDERWAND WSL much slower than Windows: the virtual disk layer is a real cost, and ELDERWAND's speed in CI does not come from "bare metal".
- T3 last 60 s far below first 30 s: the SLC cache ran out. Compare the two drives' drop point.
- T2 is the best single number for CI-like work (many small flushes). A PLP drive should be far below the QLC drive here.

## PromQL used (re-runnable)

Run as `query_range`, `step=60`, over each CI window. Host is `instance="192.168.4.192:9100"`, workers `192.168.6.25–27:9100`.

```promql
# Disk busy / queue depth / write+read latency (ms) / MB/s (host NVMe)
rate(node_disk_io_time_seconds_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m])
rate(node_disk_io_time_weighted_seconds_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m])
rate(node_disk_write_time_seconds_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m])
  / rate(node_disk_writes_completed_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m]) * 1000
rate(node_disk_read_time_seconds_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m])
  / rate(node_disk_reads_completed_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m]) * 1000
rate(node_disk_written_bytes_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m]) / 1e6

# Discards and flushes on the physical drive
rate(node_disk_discarded_sectors_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m]) * 512 / 1e6
rate(node_disk_flush_requests_total{instance="192.168.4.192:9100",device="nvme0n1"}[2m])

# Guest disk write latency (ms) inside the workers
rate(node_disk_write_time_seconds_total{instance=~"192.168.6.2[5-7]:9100",device="sda"}[2m])
  / rate(node_disk_writes_completed_total{instance=~"192.168.6.2[5-7]:9100",device="sda"}[2m]) * 1000

# Worker CPU (user+sys %) and iowait %
100 * sum by (instance) (rate(node_cpu_seconds_total{instance=~"192.168.6.2[5-7]:9100",mode=~"user|system|softirq|irq|nice"}[2m]))
  / count by (instance) (node_cpu_seconds_total{instance=~"192.168.6.2[5-7]:9100",mode="idle"})
100 * avg by (instance) (rate(node_cpu_seconds_total{instance=~"192.168.6.2[5-7]:9100",mode="iowait"}[2m]))

# Pressure (PSI) on workers
rate(node_pressure_io_waiting_seconds_total{instance=~"192.168.6.2[5-7]:9100"}[2m])
rate(node_pressure_cpu_waiting_seconds_total{instance=~"192.168.6.2[5-7]:9100"}[2m])
rate(node_pressure_memory_waiting_seconds_total{instance=~"192.168.6.2[5-7]:9100"}[2m])

# Host memory available, CPU temperature, CPU clock
node_memory_MemAvailable_bytes{instance="192.168.4.192:9100"} / 1e9
max(node_hwmon_temp_celsius{instance="192.168.4.192:9100"})
avg(node_cpu_scaling_frequency_hertz{instance="192.168.4.192:9100"}) / 1e6

# Runner throttling and writes by namespace
sum by (container) (rate(container_cpu_cfs_throttled_periods_total{namespace="arc-runners"}[2m]))
  / sum by (container) (rate(container_cpu_cfs_periods_total{namespace="arc-runners"}[2m]))
sum by (namespace) (rate(container_fs_writes_bytes_total[2m])) / 1e6
```

## Method and limits

- Statistics pool every minute sample from 19 run windows; a window is `createdAt` to `updatedAt`, or the last hour for runs with re-attempts. Idle time inside a window (queueing, skipped jobs) lowers averages, so p90 is the better view of load.
- Only worker-1 was checked for the `/` mount options and `fstrim.timer`. Workers 2 and 3 are assumed identical (research task 6).
- Guest and host latency are not on the same footing: the guest figure includes virtualisation and LVM-thin delay.
- CPU temperature is the hottest `node_hwmon_temp_celsius` series, which may not be the CPU package sensor.
- Scratch helper used for the numbers: a Python script in the session scratchpad. Not committed.
