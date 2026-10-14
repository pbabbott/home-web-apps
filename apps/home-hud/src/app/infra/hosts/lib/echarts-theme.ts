import type * as echarts from 'echarts';
import {
  accentFalcon,
  accentPurple,
  error,
  neutral,
  primary,
  secondary,
  warning,
} from '@abbottland/fui-components';

/**
 * Per-core line colors, cycled if a host has more cores than colors. Drawn
 * only from the brand identity colors (primary/secondary/accent-*) — not
 * success/warning/error, which are reserved for actual host status
 * (`STATUS_BADGE_COLOR` in HostsClient.tsx) and would misread as "this core
 * is in trouble" if reused here.
 */
export const CPU_LINE_PALETTE: string[] = [
  primary[500],
  secondary[400],
  accentPurple[400],
  accentFalcon[400],
  primary[300],
  secondary[200],
];

/**
 * Memory stack colors, ordered used/buffers/cached/free. `used` gets the
 * brand teal (the same `primary` used for the active-host border/badge
 * elsewhere on this page) since it's the band that matters most; `free`
 * is neutral since it's "nothing happening."
 */
export const MEMORY_STACK_PALETTE: string[] = [
  primary[500],
  secondary[400],
  accentPurple[400],
  neutral[600],
];

/**
 * Per-device colors for the disk I/O chart, cycled if a host has more
 * devices than colors (e.g. 6 disks). read/written/ioTime for the same
 * device share a color and are told apart by line style instead (solid/
 * dashed/dotted) — one color per metric-per-device (18 colors for a 6-disk
 * host) would be unreadable.
 */
export const DISK_DEVICE_PALETTE: string[] = [
  primary[500],
  secondary[400],
  accentPurple[400],
  accentFalcon[400],
  primary[300],
  secondary[200],
];

/**
 * Per-sensor line colors for the temperature chart, cycled if a host has
 * more sensors than colors (e.g. CPU package + 4 cores + an NVMe drive).
 */
export const TEMPERATURE_LINE_PALETTE: string[] = [
  primary[500],
  secondary[400],
  accentPurple[400],
  accentFalcon[400],
  primary[300],
  secondary[200],
];

/**
 * Generic warning/critical thresholds (°C) drawn as flat reference lines
 * on the temperature chart. One pair for the whole chart even though it
 * mixes CPU and NVMe sensors — not sensor-specific (Prometheus does expose
 * per-sensor node_hwmon_temp_crit_celsius, e.g. 105°C for this host's CPU,
 * 87.85°C for its NVMe, but a single at-a-glance line reads better than a
 * tangle of per-sensor lines). 70°C/85°C sit well under either of this
 * host's real crit values while still being low enough to flag real
 * sustained-load concern on typical consumer/server hardware. These use
 * the actual semantic warning/error tokens (unlike the brand-only chart
 * line palettes above) since they're a genuine threshold indicator, not
 * decoration — same reasoning as the disk-space usage bars.
 */
export const TEMPERATURE_WARNING_CELSIUS = 70;
export const TEMPERATURE_CRITICAL_CELSIUS = 85;
export const TEMPERATURE_WARNING_COLOR = warning[400];
export const TEMPERATURE_CRITICAL_COLOR = error[500];

/** Shared axis/grid/tooltip chrome tuned for the dark `neutral` backdrop. */
export const CHART_AXIS_COLOR = neutral[400];
export const CHART_SPLIT_LINE_COLOR = neutral[700];
export const CHART_TOOLTIP_BG = neutral[950];
export const CHART_TOOLTIP_BORDER = neutral[700];
export const CHART_TEXT_COLOR = neutral[300];

/**
 * Paginated legend for charts whose series count can outgrow the available
 * width (per-sensor temperature lines, per-device disk I/O lines) — without
 * `type: 'scroll'` echarts shrinks/wraps entries until they're illegible
 * instead of paging. Use for any chart legend where the series list is
 * data-driven rather than a small fixed set.
 */
export function scrollableLegend(
  data: string[],
): echarts.LegendComponentOption {
  return {
    type: 'scroll',
    top: 0,
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 10,
    pageIconColor: CHART_AXIS_COLOR,
    pageTextStyle: { color: CHART_AXIS_COLOR },
    textStyle: { color: CHART_TEXT_COLOR, fontSize: 10 },
    data,
  };
}
