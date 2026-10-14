import {
  NODE_EXPORTER_JOB_MATCH,
  queryInstant,
  queryRange,
  tagComponent,
  type TimeseriesSample,
} from './client';

// Real physical disks only, one line per disk — excludes:
// - partitions (mmcblk0p1, mmcblk0boot0): same physical card as the
//   whole-disk mmcblk0 series, just split up, so matches the bare
//   "mmcblkN" form rather than node_exporter mixin's own partition-level
//   "mmcblk.p.+" (sd*/nvme*/vd* don't expose partition-level stats
//   separately on hosts seen so far, so no equivalent narrowing needed
//   there).
// - dm-/md-/rbd- (LVM/RAID/Ceph logical devices): on a hypervisor host
//   (e.g. Proxmox), each VM/container disk is its own dm- device, so an
//   unfiltered host can report 50+ of them — noise that also
//   double-counts I/O already attributed to the physical disk underneath.
const DISK_DEVICE_MATCH =
  'device=~"(/dev/)?(mmcblk[0-9]+|nvme.+|sd.+|vd.+|xvd.+|dasd.+)"';

/**
 * Disk I/O for a single node over a time range: read/written throughput
 * (bytes/sec) and io time (0-1 busy ratio) per block device. The real
 * `device` label is left untouched so a multi-disk host still gets
 * per-device lines.
 */
export async function getNodeDiskIoSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const rate = (metric: string) =>
    `rate(node_disk_${metric}_total{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}", ${DISK_DEVICE_MATCH}}[${rateWindow}])`;

  const [read, written, ioTime] = await Promise.all([
    queryRange(rate('read_bytes'), startSec, endSec, stepSec),
    queryRange(rate('written_bytes'), startSec, endSec, stepSec),
    queryRange(rate('io_time_seconds'), startSec, endSec, stepSec),
  ]);

  return [
    ...tagComponent(read, 'read'),
    ...tagComponent(written, 'written'),
    ...tagComponent(ioTime, 'ioTime'),
  ];
}

/**
 * Current filesystem size/available (bytes) per mountpoint — an instant
 * snapshot (backs a table, not a chart). `size`/`avail` are zipped by
 * `mountpoint` in the service layer.
 */
export async function getNodeDiskSpace(instance: string): Promise<{
  size: { metric: Record<string, string>; value: number }[];
  avail: { metric: Record<string, string>; value: number }[];
}> {
  const gauge = (metric: string) =>
    `max by (mountpoint) (node_filesystem_${metric}_bytes{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}", fstype!="", mountpoint!=""})`;

  const [size, avail] = await Promise.all([
    queryInstant(gauge('size')),
    queryInstant(gauge('avail')),
  ]);

  return { size, avail };
}
