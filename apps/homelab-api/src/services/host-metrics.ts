import { getHostById } from '@abbottland/homelab-db';
import { db } from '../db';
import { getNodeCpuSeries } from '../api/prometheus/prometheus-client';

export interface HostCpuSeriesPoint {
  t: number;
  value: number;
}

export interface HostCpuSeries {
  cpu: string;
  points: HostCpuSeriesPoint[];
}

export interface HostCpuMetrics {
  instance: string | null;
  stepSeconds: number;
  series: HostCpuSeries[];
}

export interface GetHostCpuSeriesOptions {
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
  { rangeSeconds, stepSeconds }: GetHostCpuSeriesOptions,
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
