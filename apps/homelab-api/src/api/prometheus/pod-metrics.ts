import { config } from '../../config';
import { queryInstant } from './client';

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
