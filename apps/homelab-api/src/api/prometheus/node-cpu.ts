import {
  NODE_EXPORTER_JOB_MATCH,
  queryRange,
  type TimeseriesSample,
} from './client';

/**
 * Per-CPU usage ratio (0-1) for a single node over a time range, one series
 * per `cpu` label. Unlike the fleet-wide query in node-fleet.ts, `cpu` is
 * kept rather than dropped, so `sum without (mode)` must still run *inside*
 * each cpu — otherwise the left side keeps a `mode` label the unlabeled
 * right side can never match, and the join would silently produce nothing.
 */
export async function getNodeCpuSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const promql = `(
  (1 - sum without (mode) (rate(node_cpu_seconds_total{${NODE_EXPORTER_JOB_MATCH}, mode=~"idle|iowait|steal", instance="${instance}"}[${rateWindow}])))
  / ignoring(cpu) group_left
  count without (cpu, mode) (node_cpu_seconds_total{${NODE_EXPORTER_JOB_MATCH}, mode="idle", instance="${instance}"})
)`;

  return queryRange(promql, startSec, endSec, stepSec);
}
