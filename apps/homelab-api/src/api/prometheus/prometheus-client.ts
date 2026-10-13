import { config } from '../../config';

const QUERY_PATH = '/api/v1/query';
const QUERY_RANGE_PATH = '/api/v1/query_range';
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

type PrometheusMatrixResponse = {
  status: 'success' | 'error';
  data: {
    resultType: 'matrix';
    result: {
      metric: Record<string, string>;
      values: [number, string][];
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

export type TimeseriesSample = {
  metric: Record<string, string>;
  values: { t: number; value: number }[];
};

/**
 * Runs a PromQL range query and returns the raw matrix samples. Same
 * best-effort contract as `queryInstant` — empty array on any failure so
 * callers can enrich-if-available rather than fail the whole request.
 */
async function queryRange(
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

function keyByInstance(
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

// Matches both "node-exporter" (in-cluster k8s nodes) and
// "node-exporter-physical" (standalone homelab hosts scraped directly, not
// via k8s service discovery) — any future job variant following this
// naming convention (e.g. a "node-exporter-virtual") is picked up too.
const NODE_EXPORTER_JOB_MATCH = 'job=~"node-exporter.*"';

/**
 * node-exporter's `up` series is keyed by Prometheus's own scrape labels
 * (job/instance) directly — `instance` is the scrape-target address (e.g.
 * "192.168.6.24:9100"), the same value homelab-db stores as `hosts.instance`
 * — so no join against another metric is needed. A host whose node-exporter
 * target isn't in Prometheus's service discovery at all simply won't appear
 * in this map (caller should treat "missing" as "unknown", not "online").
 */
export async function getNodeUp(): Promise<Map<string, number>> {
  const promql = `up{${NODE_EXPORTER_JOB_MATCH}}`;

  return keyByInstance(await queryInstant(promql));
}

/**
 * CPU usage ratio (0-1) per node, keyed by `instance`. Adapted from a
 * known-good external dashboard query — the "idle|iowait|steal" modes are
 * excluded from the busy-time sum, and the result is normalized by the
 * node's CPU count via `count without (cpu, mode) (..., mode="idle")`.
 * `instance` survives both sides of this query untouched (only `cpu`/`mode`
 * are ever dropped), so — unlike `up` above — this needs no join either.
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

/**
 * Per-CPU usage ratio (0-1) for a single node over a time range, one series
 * per `cpu` label (e.g. 4 series for a 4-core host) — unlike
 * `getNodeCpuUsage` above, `cpu` is deliberately kept rather than dropped.
 * `sum without (mode)` still collapses idle/iowait/steal *within* each cpu
 * (same as the instant query) — leaving it out would leave a `mode` label
 * on the left side that the right side (which has no `mode` label at all)
 * can never match, and `ignoring(cpu) group_left` would silently join to
 * nothing. Each core's rate is divided by the node's core count, so the
 * per-core lines sum to the host's total busy ratio. `instance` is pinned
 * to a single host (pushed into the query) since this backs a per-host
 * chart, not a fleet-wide map.
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
