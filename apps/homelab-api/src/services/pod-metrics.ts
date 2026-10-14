import { getPod } from '../api/kubernetes/kubernetes-client';
import {
  getPodCpuUsageSeries,
  getPodMemoryUsageSeries,
} from '../api/prometheus';
import { parseCpuQuantity, parseMemoryQuantity } from '../lib/k8s-quantity';
import { sumContainerQuantities } from './pod-map';

export interface PodMetricSeriesPoint {
  t: number;
  value: number;
}

export interface PodContainerSeries {
  container: string;
  points: PodMetricSeriesPoint[];
}

export interface PodCpuMetrics {
  stepSeconds: number;
  series: PodContainerSeries[];
  requestCores: number | null;
  limitCores: number | null;
}

export interface PodMemoryMetrics {
  stepSeconds: number;
  series: PodContainerSeries[];
  requestBytes: number | null;
  limitBytes: number | null;
}

export interface GetPodMetricsSeriesOptions {
  rangeSeconds: number;
  stepSeconds: number;
}

/**
 * Per-container CPU usage history for a single pod, plus its declared
 * request/limit (summed across containers) drawn as flat reference lines by
 * the caller. `undefined` means the pod itself doesn't exist (404) — a
 * missing Prometheus series still comes back as an empty `series` array.
 */
export async function getPodCpuSeries(
  namespace: string,
  podName: string,
  { rangeSeconds, stepSeconds }: GetPodMetricsSeriesOptions,
): Promise<PodCpuMetrics | undefined> {
  const pod = await getPod(namespace, podName);
  if (!pod) return undefined;

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - rangeSeconds;

  const samples = await getPodCpuUsageSeries(
    namespace,
    podName,
    startSec,
    endSec,
    stepSeconds,
  );

  const series = samples
    .filter((sample) => sample.metric.container !== undefined)
    .map((sample) => ({
      container: sample.metric.container,
      points: sample.values,
    }));

  return {
    stepSeconds,
    series,
    requestCores: sumContainerQuantities(
      pod,
      'requests',
      'cpu',
      parseCpuQuantity,
    ),
    limitCores: sumContainerQuantities(pod, 'limits', 'cpu', parseCpuQuantity),
  };
}

/** Same contract as {@link getPodCpuSeries}, for memory (working-set bytes). */
export async function getPodMemorySeries(
  namespace: string,
  podName: string,
  { rangeSeconds, stepSeconds }: GetPodMetricsSeriesOptions,
): Promise<PodMemoryMetrics | undefined> {
  const pod = await getPod(namespace, podName);
  if (!pod) return undefined;

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - rangeSeconds;

  const samples = await getPodMemoryUsageSeries(
    namespace,
    podName,
    startSec,
    endSec,
    stepSeconds,
  );

  const series = samples
    .filter((sample) => sample.metric.container !== undefined)
    .map((sample) => ({
      container: sample.metric.container,
      points: sample.values,
    }));

  return {
    stepSeconds,
    series,
    requestBytes: sumContainerQuantities(
      pod,
      'requests',
      'memory',
      parseMemoryQuantity,
    ),
    limitBytes: sumContainerQuantities(
      pod,
      'limits',
      'memory',
      parseMemoryQuantity,
    ),
  };
}
