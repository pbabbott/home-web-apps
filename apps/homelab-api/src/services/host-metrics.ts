import { getHostById } from '@abbottland/homelab-db';
import { db } from '../db';
import {
  getNodeCpuSeries,
  getNodeDiskIoSeries,
  getNodeDiskSpace,
  getNodeMemorySeries,
} from '../api/prometheus/prometheus-client';

export interface HostMetricSeriesPoint {
  t: number;
  value: number;
}

export interface HostCpuSeries {
  cpu: string;
  points: HostMetricSeriesPoint[];
}

export interface HostCpuMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostCpuSeries[];
}

export type MemoryComponent = 'used' | 'buffers' | 'cached' | 'free';

export interface HostMemorySeries {
  component: MemoryComponent;
  points: HostMetricSeriesPoint[];
}

export interface HostMemoryMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostMemorySeries[];
}

export interface GetHostMetricsSeriesOptions {
  rangeSeconds: number;
  stepSeconds: number;
}

/**
 * Per-CPU usage history for a single host. Best-effort like `enrichHosts`:
 * a host with no `instance` set returns an empty series (not an error) so
 * the UI can render an empty state rather than fail the request.
 */
export async function getHostCpuSeries(
  id: string,
  { rangeSeconds, stepSeconds }: GetHostMetricsSeriesOptions,
): Promise<HostCpuMetrics | undefined> {
  const host = await getHostById(db, id);
  if (!host) return undefined;

  if (!host.instance) {
    return { instance: null, stepSeconds, series: [] };
  }

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - rangeSeconds;

  const samples = await getNodeCpuSeries(
    host.instance,
    startSec,
    endSec,
    stepSeconds,
  );

  const series = samples
    .filter((sample) => sample.metric.cpu !== undefined)
    .map((sample) => ({
      cpu: sample.metric.cpu,
      points: sample.values,
    }));

  return { instance: host.instance, stepSeconds, series };
}

/**
 * Memory breakdown (used/buffers/cached/free, in bytes) for a single host.
 * Same best-effort contract as `getHostCpuSeries`.
 */
export async function getHostMemorySeries(
  id: string,
  { rangeSeconds, stepSeconds }: GetHostMetricsSeriesOptions,
): Promise<HostMemoryMetrics | undefined> {
  const host = await getHostById(db, id);
  if (!host) return undefined;

  if (!host.instance) {
    return { instance: null, stepSeconds, series: [] };
  }

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - rangeSeconds;

  const samples = await getNodeMemorySeries(
    host.instance,
    startSec,
    endSec,
    stepSeconds,
  );

  const series = samples
    .filter(
      (sample): sample is typeof sample & { metric: { component: string } } =>
        sample.metric.component !== undefined,
    )
    .map((sample) => ({
      component: sample.metric.component as MemoryComponent,
      points: sample.values,
    }));

  return { instance: host.instance, stepSeconds, series };
}

export type DiskIoComponent = 'read' | 'written' | 'ioTime';

export interface HostDiskIoSeries {
  device: string;
  component: DiskIoComponent;
  points: HostMetricSeriesPoint[];
}

export interface HostDiskIoMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostDiskIoSeries[];
}

/**
 * Per-device disk I/O history (read/written bytes-per-sec, io time ratio)
 * for a single host. Same best-effort contract as `getHostCpuSeries`.
 */
export async function getHostDiskIoSeries(
  id: string,
  { rangeSeconds, stepSeconds }: GetHostMetricsSeriesOptions,
): Promise<HostDiskIoMetrics | undefined> {
  const host = await getHostById(db, id);
  if (!host) return undefined;

  if (!host.instance) {
    return { instance: null, stepSeconds, series: [] };
  }

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - rangeSeconds;

  const samples = await getNodeDiskIoSeries(
    host.instance,
    startSec,
    endSec,
    stepSeconds,
  );

  const series = samples
    .filter(
      (
        sample,
      ): sample is typeof sample & {
        metric: { device: string; component: string };
      } =>
        sample.metric.device !== undefined &&
        sample.metric.component !== undefined,
    )
    .map((sample) => ({
      device: sample.metric.device,
      component: sample.metric.component as DiskIoComponent,
      points: sample.values,
    }));

  return { instance: host.instance, stepSeconds, series };
}

export interface HostDiskMountpoint {
  mountpoint: string;
  sizeBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedRatio: number;
}

export interface HostDiskSpace {
  instance: string | null;
  mountpoints: HostDiskMountpoint[];
}

/**
 * Current filesystem usage per mountpoint for a single host — a snapshot
 * (no rangeSeconds/stepSeconds, unlike the other metrics here) since this
 * backs a table, not a chart. Same best-effort contract otherwise: no
 * instance means an empty list, not an error.
 */
export async function getHostDiskSpace(
  id: string,
): Promise<HostDiskSpace | undefined> {
  const host = await getHostById(db, id);
  if (!host) return undefined;

  if (!host.instance) {
    return { instance: null, mountpoints: [] };
  }

  const { size, avail } = await getNodeDiskSpace(host.instance);

  const availByMountpoint = new Map(
    avail
      .filter((sample) => sample.metric.mountpoint !== undefined)
      .map((sample) => [sample.metric.mountpoint, sample.value]),
  );

  const mountpoints = size
    .filter((sample) => sample.metric.mountpoint !== undefined)
    .map((sample) => {
      const mountpoint = sample.metric.mountpoint;
      const sizeBytes = sample.value;
      const availableBytes = availByMountpoint.get(mountpoint) ?? 0;
      const usedBytes = sizeBytes - availableBytes;

      return {
        mountpoint,
        sizeBytes,
        availableBytes,
        usedBytes,
        usedRatio: sizeBytes > 0 ? usedBytes / sizeBytes : 0,
      };
    })
    .sort((a, b) => a.mountpoint.localeCompare(b.mountpoint));

  return { instance: host.instance, mountpoints };
}
