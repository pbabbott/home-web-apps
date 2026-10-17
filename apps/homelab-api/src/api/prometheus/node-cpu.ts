import {
  NODE_EXPORTER_JOB_MATCH,
  queryRange,
  type TimeseriesSample,
} from './client';

/**
 * Per-CPU usage ratio (0-1) for a single node over a time range, one series
 * per `cpu` label — each core's own busy ratio, matching what a per-core
 * view (e.g. Proxmox) shows. `sum without (mode)` collapses idle/iowait/
 * steal *within* each cpu (keeping the `cpu` label), so `1 - that` is
 * already a 0-1 ratio per core; no further division by core count belongs
 * here — that normalization is only correct when reducing to a single
 * host-wide number, which is what the fleet-wide query in node-fleet.ts is
 * for.
 */
export async function getNodeCpuSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const promql = `1 - sum without (mode) (rate(node_cpu_seconds_total{${NODE_EXPORTER_JOB_MATCH}, mode=~"idle|iowait|steal", instance="${instance}"}[${rateWindow}]))`;

  return queryRange(promql, startSec, endSec, stepSec);
}
