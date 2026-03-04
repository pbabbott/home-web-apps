/**
 * Brand colors for HexagonalBackground (grid + spark effect).
 */

import { neutral, primary } from '../../tokens';

/** Convert 6-char hex to rgba string for opacity variants */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const C = {
  bg: neutral[1000],
  hexStroke: hexToRgba(primary[700], 0.1),
  hexFill: 'rgba(0,0,0,0)' as const,
  sparkCore: primary[500],
  sparkGlow: primary[700],
  sparkHead: primary[200],
} as const;
