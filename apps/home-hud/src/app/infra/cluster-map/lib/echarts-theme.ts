import {
  accentFalcon,
  accentPurple,
  error,
  neutral,
  primary,
  secondary,
  warning,
} from '@abbottland/fui-components';

/** Per-container line colors, cycled if a pod has more containers than colors. */
export const POD_CONTAINER_PALETTE: string[] = [
  primary[500],
  secondary[400],
  accentPurple[400],
  accentFalcon[400],
  primary[300],
  secondary[200],
];

/**
 * Flat request/limit reference lines, matching the dashed red/orange lines
 * on the Grafana pod CPU/memory panels these charts are transcribed from.
 */
export const REQUEST_LINE_COLOR = warning[400];
export const LIMIT_LINE_COLOR = error[500];

/** Shared axis/grid/tooltip chrome tuned for the dark `neutral` backdrop. */
export const CHART_AXIS_COLOR = neutral[400];
export const CHART_SPLIT_LINE_COLOR = neutral[700];
export const CHART_TOOLTIP_BG = neutral[950];
export const CHART_TOOLTIP_BORDER = neutral[700];
export const CHART_TEXT_COLOR = neutral[300];

/** 12-hour `8:30pm` ticks for the time x-axis, instead of echarts' default 24-hour `20:30`. */
export function formatTimeTick(value: number): string {
  const date = new Date(value);
  const minutes = date.getMinutes();
  const period = date.getHours() >= 12 ? 'pm' : 'am';
  const hours = date.getHours() % 12 || 12;

  return `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
}
