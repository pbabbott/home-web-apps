import { config } from '../../config';

const QUERY_PATH = '/api/v1/query';
const REQUEST_TIMEOUT_MS = 5000;

type PrometheusVectorResponse = {
  status: 'success' | 'error';
  data: {
    resultType: 'vector';
    result: {
      metric: Record<string, string>;
      value: [number, string];
    }[];
  };
};

/**
 * Runs a PromQL instant query and returns the raw vector samples. Returns an
 * empty array on any failure (timeout, non-200, malformed body) so callers
 * can enrich-if-available rather than fail the whole map.
 */
async function queryInstant(
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

function keyByNamespacedPod(
  samples: { metric: Record<string, string>; value: number }[],
): Map<string, number> {
  const byPod = new Map<string, number>();

  for (const sample of samples) {
    const { namespace, pod } = sample.metric;
    if (!namespace || !pod) continue;

    byPod.set(`${namespace}/${pod}`, sample.value);
  }

  return byPod;
}

/** CPU usage per pod, in cores, keyed `<namespace>/<pod>`. */
export async function getPodCpuUsage(): Promise<Map<string, number>> {
  const window = `${config.prometheusQueryWindowSeconds}s`;
  const promql = `sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{container!="", pod!=""}[${window}]))`;

  return keyByNamespacedPod(await queryInstant(promql));
}

/** Memory working-set usage per pod, in bytes, keyed `<namespace>/<pod>`. */
export async function getPodMemoryUsage(): Promise<Map<string, number>> {
  const promql =
    'sum by (namespace, pod) (container_memory_working_set_bytes{container!="", pod!=""})';

  return keyByNamespacedPod(await queryInstant(promql));
}
