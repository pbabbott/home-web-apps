import {
  accentFalcon,
  accentPurple,
  neutral,
  primary,
  secondary,
  success,
  warning,
} from '@abbottland/fui-components';

/**
 * Per-core line colors, cycled if a host has more cores than colors.
 * Picked from the fui palette for contrast against the page's
 * `bg-neutral-800`/`bg-neutral-900` panels.
 */
export const CPU_LINE_PALETTE: string[] = [
  primary[500],
  secondary[500],
  accentPurple[300],
  success[400],
  warning[400],
  accentFalcon[400],
];

/** Shared axis/grid/tooltip chrome tuned for the dark `neutral` backdrop. */
export const CHART_AXIS_COLOR = neutral[400];
export const CHART_SPLIT_LINE_COLOR = neutral[700];
export const CHART_TOOLTIP_BG = neutral[950];
export const CHART_TOOLTIP_BORDER = neutral[700];
export const CHART_TEXT_COLOR = neutral[300];
