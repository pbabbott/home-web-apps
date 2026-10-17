import type { ExporterType } from '@abbottland/homelab-db';
import type { TimeseriesSample } from './client';
import { getNodeCpuSeries } from './node-cpu';
import { getNodeDiskIoSeries, getNodeDiskSpace } from './node-disk';
import { getNodeCpuUsage, getNodeUp } from './node-fleet';
import { getNodeMemorySeries } from './node-memory';
import { getNodeTemperatureSeries } from './node-temperature';
import {
  getWindowsCpuSeries,
  getWindowsCpuUsage,
  getWindowsDiskIoSeries,
  getWindowsDiskSpace,
  getWindowsMemorySeries,
  getWindowsTemperatureSeries,
  getWindowsUp,
} from './windows-exporter';

type RangeQuery = (
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
) => Promise<TimeseriesSample[]>;

type InstantSamples = { metric: Record<string, string>; value: number }[];

/**
 * Everything homelab-api asks Prometheus about a host. Each exporter
 * implements the full set and returns the *same label names* (`cpu`,
 * `device`, `mountpoint`, `chip`/`sensor`/`label`, `component`), so
 * services never branch on exporter type.
 */
export interface ExporterQueries {
  up: () => Promise<Map<string, number>>;
  cpuUsage: () => Promise<Map<string, number>>;
  cpuSeries: RangeQuery;
  memorySeries: RangeQuery;
  diskIoSeries: RangeQuery;
  temperatureSeries: RangeQuery;
  diskSpace: (
    instance: string,
  ) => Promise<{ size: InstantSamples; avail: InstantSamples }>;
}

/**
 * Typed as a full Record so adding a value to `exporterTypeEnum` fails to
 * compile until its queries are wired in here.
 */
export const EXPORTERS: Record<ExporterType, ExporterQueries> = {
  node_exporter: {
    up: getNodeUp,
    cpuUsage: getNodeCpuUsage,
    cpuSeries: getNodeCpuSeries,
    memorySeries: getNodeMemorySeries,
    diskIoSeries: getNodeDiskIoSeries,
    temperatureSeries: getNodeTemperatureSeries,
    diskSpace: getNodeDiskSpace,
  },
  windows_exporter: {
    up: getWindowsUp,
    cpuUsage: getWindowsCpuUsage,
    cpuSeries: getWindowsCpuSeries,
    memorySeries: getWindowsMemorySeries,
    diskIoSeries: getWindowsDiskIoSeries,
    temperatureSeries: getWindowsTemperatureSeries,
    diskSpace: getWindowsDiskSpace,
  },
};
