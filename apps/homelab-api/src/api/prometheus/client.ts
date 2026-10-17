import { config } from '../../config';

const QUERY_PATH = '/api/v1/query';
const QUERY_RANGE_PATH = '/api/v1/query_range';
const REQUEST_TIMEOUT_MS = 5000;

// Matches both "node-exporter" (in-cluster k8s nodes) and
// "node-exporter-physical" (standalone homelab hosts scraped directly).
export const NODE_EXPORTER_JOB_MATCH = 'job=~"node-exporter.*"';

type PrometheusVectorResponse = {
  status: 'success' | 'error';
  data: {
    resultType: 'vector';
    result: { metric: Record<string, string>; value: [number, string] }[];
  };
};

type PrometheusMatrixResponse = {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix';
    result: { metric: Record<string, string>; values: [number, string][] }[];
  };
};

export type TimeseriesSample = {
  metric: Record<string, string>;
  values: { t: number; value: number }[];
};

/** Instant PromQL query. Best-effort: returns `[]` on any failure (timeout, non-200, malformed body) rather than throwing. */
export async function queryInstant(
  promql: string,
): Promise<{ metric: Record<string, string>; value: number }[]> {
  const url = `${config.prometheusUrl}${QUERY_PATH}?query=${encodeURIComponent(promql)}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[prometheus] query returned ${response.status} for: ${promql}`,
      );
      return [];
    }

    const body = (await response.json()) as PrometheusVectorResponse;

    if (body.status !== 'success') return [];

    return body.data.result.map((sample) => ({
      metric: sample.metric,
      value: Number(sample.value[1]),
    }));
  } catch (err) {
    console.warn(`[prometheus] query failed for: ${promql}`, err);
    return [];
  }
}

/** Range PromQL query. Same best-effort contract as {@link queryInstant}. */
export async function queryRange(
  promql: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const params = new URLSearchParams({
    query: promql,
    start: String(startSec),
    end: String(endSec),
    step: String(stepSec),
  });
  const url = `${config.prometheusUrl}${QUERY_RANGE_PATH}?${params}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[prometheus] range query returned ${response.status} for: ${promql}`,
      );
      return [];
    }

    const body = (await response.json()) as PrometheusMatrixResponse;

    if (body.status !== 'success') return [];

    return body.data.result.map((sample) => ({
      metric: sample.metric,
      values: sample.values.map(([t, v]) => ({ t, value: Number(v) })),
    }));
  } catch (err) {
    console.warn(`[prometheus] range query failed for: ${promql}`, err);
    return [];
  }
}

/** Tags each sample's `metric` with a synthetic label — used to fan a single series out into named components (e.g. memory used/buffers/cached/free). */
export function tagComponent(
  samples: TimeseriesSample[],
  component: string,
): TimeseriesSample[] {
  return samples.map((sample) => ({
    metric: { ...sample.metric, component },
    values: sample.values,
  }));
}

export function keyByInstance(
  samples: { metric: Record<string, string>; value: number }[],
): Map<string, number> {
  const byInstance = new Map<string, number>();

  for (const sample of samples) {
    const { instance } = sample.metric;
    if (!instance) continue;

    byInstance.set(instance, sample.value);
  }

  return byInstance;
}
