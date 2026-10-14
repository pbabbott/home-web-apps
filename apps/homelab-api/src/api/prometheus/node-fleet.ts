import { config } from '../../config';
import { keyByInstance, NODE_EXPORTER_JOB_MATCH, queryInstant } from './client';

/**
 * node-exporter's `up` series is keyed by `instance` directly (the
 * scrape-target address, e.g. "192.168.6.24:9100" — the same value
 * homelab-db stores as `hosts.instance`), so no join is needed. A host
 * missing from this map means its node-exporter target isn't in
 * Prometheus's service discovery — callers should treat that as "unknown",
 * not "online".
 */
export async function getNodeUp(): Promise<Map<string, number>> {
  const promql = `up{${NODE_EXPORTER_JOB_MATCH}}`;

  return keyByInstance(await queryInstant(promql));
}

/**
 * CPU usage ratio (0-1) per node, keyed by `instance`. Adapted from a
 * known-good external dashboard query: excludes idle/iowait/steal from the
 * busy-time sum, normalized by core count via
 * `count without (cpu, mode) (..., mode="idle")`.
 */
export async function getNodeCpuUsage(): Promise<Map<string, number>> {
  const window = `${config.prometheusQueryWindowSeconds}s`;
  const promql = `(
  (1 - sum without (mode) (rate(node_cpu_seconds_total{${NODE_EXPORTER_JOB_MATCH}, mode=~"idle|iowait|steal"}[${window}])))
  / ignoring(cpu) group_left
  count without (cpu, mode) (node_cpu_seconds_total{${NODE_EXPORTER_JOB_MATCH}, mode="idle"})
)`;

  return keyByInstance(await queryInstant(promql));
}
