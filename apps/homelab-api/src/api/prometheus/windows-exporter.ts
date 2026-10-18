import { config } from '../../config';
import {
  keyByInstance,
  queryInstant,
  queryRange,
  renameLabel,
  tagComponent,
  WINDOWS_EXPORTER_JOB_MATCH,
  type TimeseriesSample,
} from './client';

// Metric names target windows_exporter >= 0.30. Every function mirrors the
// node_exporter one of the same role (node-fleet/cpu/memory/disk/temperature)
// and returns the same label names, so host-metrics.ts shapes both alike.

// Excludes the synthetic "_Total" aggregate and hidden/system volumes
// ("HarddiskVolume3", recovery partitions) that have no drive letter.
const PHYSICAL_DISK_MATCH = 'disk!="_Total"';
const LOGICAL_DISK_MATCH = 'volume!~"HarddiskVolume.*|_Total"';

export async function getWindowsUp(): Promise<Map<string, number>> {
  const promql = `up{${WINDOWS_EXPORTER_JOB_MATCH}}`;

  return keyByInstance(await queryInstant(promql));
}

/** Node-wide CPU usage ratio (0-1) per instance, keyed by `instance`. */
export async function getWindowsCpuUsage(): Promise<Map<string, number>> {
  const window = `${config.prometheusQueryWindowSeconds}s`;
  const promql = `1 - avg by (instance) (rate(windows_cpu_time_total{${WINDOWS_EXPORTER_JOB_MATCH}, mode="idle"}[${window}]))`;

  return keyByInstance(await queryInstant(promql));
}

/** Per-core usage ratio (0-1); windows_exporter's `core` label is returned as `cpu`. */
export async function getWindowsCpuSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const promql = `1 - rate(windows_cpu_time_total{${WINDOWS_EXPORTER_JOB_MATCH}, mode="idle", instance="${instance}"}[${rateWindow}])`;

  return renameLabel(
    await queryRange(promql, startSec, endSec, stepSec),
    'core',
    'cpu',
  );
}

/**
 * Used/free only — Windows has no buffers/cached split, and the chart
 * skips components a host doesn't report.
 */
export async function getWindowsMemorySeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const gauge = (metric: string) =>
    `windows_memory_${metric}{${WINDOWS_EXPORTER_JOB_MATCH}, instance="${instance}"}`;

  const usedPromql = `(${gauge('physical_total_bytes')} - ${gauge('physical_free_bytes')})`;

  const [used, free] = await Promise.all([
    queryRange(usedPromql, startSec, endSec, stepSec),
    queryRange(gauge('physical_free_bytes'), startSec, endSec, stepSec),
  ]);

  return [...tagComponent(used, 'used'), ...tagComponent(free, 'free')];
}

/** Read/written bytes/sec and io-time busy ratio per physical disk (`disk` returned as `device`). */
export async function getWindowsDiskIoSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const rate = (metric: string) =>
    `rate(windows_physical_disk_${metric}_total{${WINDOWS_EXPORTER_JOB_MATCH}, instance="${instance}", ${PHYSICAL_DISK_MATCH}}[${rateWindow}])`;

  const [read, written, idle] = await Promise.all([
    queryRange(rate('read_bytes'), startSec, endSec, stepSec),
    queryRange(rate('write_bytes'), startSec, endSec, stepSec),
    queryRange(`1 - ${rate('idle_seconds')}`, startSec, endSec, stepSec),
  ]);

  return renameLabel(
    [
      ...tagComponent(read, 'read'),
      ...tagComponent(written, 'written'),
      ...tagComponent(idle, 'ioTime'),
    ],
    'disk',
    'device',
  );
}

/** Current size/free per volume (`volume`, e.g. "C:", returned as `mountpoint`). */
export async function getWindowsDiskSpace(instance: string): Promise<{
  size: { metric: Record<string, string>; value: number }[];
  avail: { metric: Record<string, string>; value: number }[];
}> {
  const gauge = (metric: string) =>
    `max by (volume) (windows_logical_disk_${metric}_bytes{${WINDOWS_EXPORTER_JOB_MATCH}, instance="${instance}", ${LOGICAL_DISK_MATCH}})`;

  const [size, avail] = await Promise.all([
    queryInstant(gauge('size')),
    queryInstant(gauge('free')),
  ]);

  return {
    size: renameLabel(size, 'volume', 'mountpoint'),
    avail: renameLabel(avail, 'volume', 'mountpoint'),
  };
}

/**
 * Thermal-zone temperatures (°C). The thermalzone collector is opt-in in
 * windows_exporter and many desktops expose none, so empty is expected.
 * Zone `name` becomes both chip and label (there is no hwmon chip/sensor).
 */
export async function getWindowsTemperatureSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const promql = `windows_thermalzone_temperature_celsius{${WINDOWS_EXPORTER_JOB_MATCH}, instance="${instance}"}`;

  const samples = await queryRange(promql, startSec, endSec, stepSec);

  return samples
    .filter((sample) => sample.metric.name !== undefined)
    .map((sample) => ({
      ...sample,
      metric: {
        ...sample.metric,
        chip: sample.metric.name,
        sensor: 'temp',
        label: sample.metric.name,
      },
    }));
}
