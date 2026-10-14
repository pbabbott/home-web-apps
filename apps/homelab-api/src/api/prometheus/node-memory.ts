import {
  NODE_EXPORTER_JOB_MATCH,
  queryRange,
  tagComponent,
  type TimeseriesSample,
} from './client';

/**
 * Memory breakdown for a single node over a time range: used/buffers/
 * cached/free, each a plain node_exporter gauge. `used` is computed the
 * same way the Grafana panel this was transcribed from does: total minus
 * free minus buffers minus cached.
 */
export async function getNodeMemorySeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const gauge = (metric: string) =>
    `node_memory_${metric}{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}"}`;

  const usedPromql = `(
  ${gauge('MemTotal_bytes')}
-
  ${gauge('MemFree_bytes')}
-
  ${gauge('Buffers_bytes')}
-
  ${gauge('Cached_bytes')}
)`;

  const [used, buffers, cached, free] = await Promise.all([
    queryRange(usedPromql, startSec, endSec, stepSec),
    queryRange(gauge('Buffers_bytes'), startSec, endSec, stepSec),
    queryRange(gauge('Cached_bytes'), startSec, endSec, stepSec),
    queryRange(gauge('MemFree_bytes'), startSec, endSec, stepSec),
  ]);

  return [
    ...tagComponent(used, 'used'),
    ...tagComponent(buffers, 'buffers'),
    ...tagComponent(cached, 'cached'),
    ...tagComponent(free, 'free'),
  ];
}
