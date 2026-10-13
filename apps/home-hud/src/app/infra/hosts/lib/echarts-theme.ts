import {
  accentFalcon,
  accentPurple,
  neutral,
  primary,
  secondary,
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

/** Shared axis/grid/tooltip chrome tuned for the dark `neutral` backdrop. */
export const CHART_AXIS_COLOR = neutral[400];
export const CHART_SPLIT_LINE_COLOR = neutral[700];
export const CHART_TOOLTIP_BG = neutral[950];
export const CHART_TOOLTIP_BORDER = neutral[700];
export const CHART_TEXT_COLOR = neutral[300];
