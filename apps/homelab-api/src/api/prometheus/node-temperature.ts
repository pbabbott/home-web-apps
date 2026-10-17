import {
  NODE_EXPORTER_JOB_MATCH,
  queryRange,
  type TimeseriesSample,
} from './client';

/**
 * Per-sensor temperature (°C) for a single node over a time range. Only
 * populated for physical hosts — in-cluster k8s nodes expose no hwmon data
 * (no `/sys/class/hwmon` inside a VM).
 *
 * `node_hwmon_temp_celsius` alone only has `chip`/`sensor` labels (e.g.
 * "temp1"); joining `node_hwmon_sensor_label` via `group_left(label)`
 * attaches the human name ("Package id 0", "Core 0"). `thermal_zone*` chips
 * are excluded on the labeled side since on x86 they duplicate another
 * sensor with no label of their own.
 *
 * Some boards (ARM SBCs) publish temps *only* via a `thermal_zone*` chip
 * and never emit a `node_hwmon_sensor_label` series at all — since the join
 * is an inner join, those readings would otherwise vanish entirely instead
 * of just losing their label. The trailing `or on (chip, sensor)` falls back to the
 * raw, unlabeled series only for chip/sensor pairs with no label match (a
 * plain `or` would also keep the unlabeled twin of every labeled series,
 * since the joined side's extra `label` makes the two sides differ) (named by chip/sensor in
 * the service layer instead).
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
or on (chip, sensor)
${base}`;

  return queryRange(promql, startSec, endSec, stepSec);
}
