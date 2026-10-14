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

/**
 * Memory breakdown for a single node over a time range: used/buffers/
 * cached/free, each a plain node_exporter gauge (no rate(), no join) —
 * tagged with a synthetic `component` label so the shape matches
 * `TimeseriesSample` the same way `getNodeCpuSeries`'s `cpu` label does.
 * `used` is computed the same way the Grafana panel this was transcribed
 * from does: total minus free minus buffers minus cached.
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

  const tag = (
    samples: TimeseriesSample[],
    component: string,
  ): TimeseriesSample[] =>
    samples.map((sample) => ({
      metric: { ...sample.metric, component },
      values: sample.values,
    }));

  const [used, buffers, cached, free] = await Promise.all([
    queryRange(usedPromql, startSec, endSec, stepSec),
    queryRange(gauge('Buffers_bytes'), startSec, endSec, stepSec),
    queryRange(gauge('Cached_bytes'), startSec, endSec, stepSec),
    queryRange(gauge('MemFree_bytes'), startSec, endSec, stepSec),
  ]);

  return [
    ...tag(used, 'used'),
    ...tag(buffers, 'buffers'),
    ...tag(cached, 'cached'),
    ...tag(free, 'free'),
  ];
}

// Real block devices only — excludes loop devices, device-mapper slaves,
// and partitions. Same device-name regex node_exporter's own mixin uses.
const DISK_DEVICE_MATCH =
  'device=~"(/dev/)?(mmcblk.p.+|nvme.+|rbd.+|sd.+|vd.+|xvd.+|dm-.+|md.+|dasd.+)"';

/**
 * Disk I/O for a single node over a time range: read/written throughput
 * (bytes/sec) and io time (0-1 busy ratio) per block device — tagged with
 * a synthetic `component` label the same way `getNodeMemorySeries` tags
 * used/buffers/cached/free, with the real `device` label left untouched so
 * a multi-disk host (e.g. 6 devices) still differentiates per-device lines.
 */
export async function getNodeDiskIoSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const rateWindow = `${Math.max(stepSec * 4, 60)}s`;
  const rate = (metric: string) =>
    `rate(node_disk_${metric}_total{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}", ${DISK_DEVICE_MATCH}}[${rateWindow}])`;

  const tag = (
    samples: TimeseriesSample[],
    component: string,
  ): TimeseriesSample[] =>
    samples.map((sample) => ({
      metric: { ...sample.metric, component },
      values: sample.values,
    }));

  const [read, written, ioTime] = await Promise.all([
    queryRange(rate('read_bytes'), startSec, endSec, stepSec),
    queryRange(rate('written_bytes'), startSec, endSec, stepSec),
    queryRange(rate('io_time_seconds'), startSec, endSec, stepSec),
  ]);

  return [
    ...tag(read, 'read'),
    ...tag(written, 'written'),
    ...tag(ioTime, 'ioTime'),
  ];
}

/**
 * Current filesystem size/available (bytes) per mountpoint for a single
 * node — an instant snapshot, not a time range, since this backs a table
 * (current usage per mount) rather than a chart. `size`/`avail` are zipped
 * by `mountpoint` in the service layer since both queries share that label
 * untouched (no join needed here either).
 */
export async function getNodeDiskSpace(instance: string): Promise<{
  size: { metric: Record<string, string>; value: number }[];
  avail: { metric: Record<string, string>; value: number }[];
}> {
  const gauge = (metric: string) =>
    `max by (mountpoint) (node_filesystem_${metric}_bytes{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}", fstype!="", mountpoint!=""})`;

  const [size, avail] = await Promise.all([
    queryInstant(gauge('size')),
    queryInstant(gauge('avail')),
  ]);

  return { size, avail };
}

/**
 * Per-sensor temperature (°C) for a single node over a time range — only
 * ever populated for standalone physical hosts (the `node-exporter-physical`
 * job in `NODE_EXPORTER_JOB_MATCH`): in-cluster k8s nodes expose no hwmon
 * data in this Prometheus (verified empty for a real `job="node-exporter"`
 * instance), since the sensors it reads (`/sys/class/hwmon`) don't exist
 * inside a VM. `node_hwmon_temp_celsius` alone only has `chip`/`sensor`
 * labels (e.g. "temp1") — joining `node_hwmon_sensor_label` (an info metric,
 * value always 1) via `group_left(label)` attaches the human name ("Package
 * id 0", "Core 0", "Composite"). `thermal_zone*` chips are excluded: on x86
 * hosts they duplicate one of the other sensors (the ACPI thermal zone)
 * without a `node_hwmon_sensor_label` entry to name it, so they'd show as
 * an unlabeled extra line.
 *
 * Some boards (e.g. ARM SBCs) publish temps *only* via a `thermal_zone*`
 * chip and never emit a `node_hwmon_sensor_label` series for it at all —
 * the join above is an inner join (`*` requires a match on both sides), so
 * those readings would vanish entirely rather than just lose their label.
 * The trailing `or` falls back to the raw, unlabeled series whenever no
 * label match exists, so real readings still surface (named by chip/sensor
 * in the service layer) instead of being silently dropped.
 */
export async function getNodeTemperatureSeries(
  instance: string,
  startSec: number,
  endSec: number,
  stepSec: number,
): Promise<TimeseriesSample[]> {
  const base = `node_hwmon_temp_celsius{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}", chip!~"thermal_zone.*"}`;
  const promql = `(
  ${base}
  * on (chip, sensor) group_left(label)
  node_hwmon_sensor_label{${NODE_EXPORTER_JOB_MATCH}, instance="${instance}"}
)
or
${base}`;

  return queryRange(promql, startSec, endSec, stepSec);
}
